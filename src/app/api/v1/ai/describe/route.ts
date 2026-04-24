import { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  type AiDescribeKind,
  type AiDescribePromptContext,
} from "@/lib/anthropic/prompts";

/**
 * POST /api/v1/ai/describe
 *
 * Streams a warm, brand-voiced draft description for one of three creator
 * surfaces (plate / bio / caption) via Server-Sent Events.
 *
 * Flow:
 *   1. auth  → supabase.auth.getUser()                     401 if missing
 *   2. rate  → checkRateLimit("ai_describe:<uid>", 30/hr)  429 if exceeded
 *   3. model → anthropic.messages.stream(...)
 *   4. pipe  → each text_delta becomes `data: {"type":"delta","text":"..."}`
 *   5. done  → `data: {"type":"done"}`
 *
 * On missing ANTHROPIC_API_KEY or Anthropic outage we return a JSON 503 so
 * the client can render a friendly toast and leave the textarea manually
 * editable (graceful degradation, ADR-3).
 */

// Caps — protect cost and context budget. At 4 images × ~1.2k tokens each
// we stay well under any creator's reasonable usage per call.
const MAX_IMAGE_URLS = 4;
const MAX_STARTER_CHARS = 1000;
const MAX_HINT_CHARS = 300;
// Output budget: plate drafts are <=500 chars (~150 tokens). Give the model
// headroom for bio/caption variations + safety margin, but cap so a runaway
// generation can't burn a creator's rate-limit budget in one call.
const MAX_OUTPUT_TOKENS = 600;

// Rate limit: 30 AI calls per creator per hour. Keeps a rapid
// upload → regenerate → tweak loop comfortable while capping per-account
// spend at ~$0.15/hr worst case (ADR-5).
const AI_DESCRIBE_MAX = 30;
const AI_DESCRIBE_WINDOW_MS = 60 * 60 * 1000;

// Node runtime (not edge) — the Anthropic SDK stream iterator isn't
// edge-compatible in every version we might pull in, and we want
// consistent behavior across dev + Netlify.
export const runtime = "nodejs";
// Don't cache streaming responses.
export const dynamic = "force-dynamic";

interface AiDescribeRequestBody {
  kind?: AiDescribeKind;
  imageUrls?: string[];
  starter?: string;
  hint?: string;
  context?: AiDescribePromptContext;
}

function isValidKind(value: unknown): value is AiDescribeKind {
  return value === "plate" || value === "bio" || value === "caption";
}

/**
 * Only accept http(s) URLs for images. The creator's photos live on the
 * Supabase Storage public URL surface, so any trusted image will have a
 * proper scheme. Rejecting data:/javascript:/file: schemes prevents a
 * creator (or an injection attempt via a forged request) from piping
 * arbitrary content to the model.
 */
function isSafeHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: AiDescribeRequestBody;
  try {
    body = (await request.json()) as AiDescribeRequestBody;
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const kind = body.kind;
  if (!isValidKind(kind)) {
    return apiError(
      "Invalid kind. Expected 'plate', 'bio', or 'caption'.",
      400
    );
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter(isSafeHttpUrl).slice(0, MAX_IMAGE_URLS)
    : [];

  // Plate descriptions require at least one image — otherwise the model has
  // nothing to anchor sensory detail to and the output drifts generic.
  if (kind === "plate" && imageUrls.length === 0) {
    return apiError(
      "At least one plate photo is required to draft a description.",
      400
    );
  }

  const starter =
    typeof body.starter === "string"
      ? body.starter.slice(0, MAX_STARTER_CHARS)
      : undefined;
  const hint =
    typeof body.hint === "string"
      ? body.hint.slice(0, MAX_HINT_CHARS)
      : undefined;
  const context = body.context;

  // Auth — only authenticated creators can spend our Anthropic budget.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Not authenticated.", 401);
  }

  // Per-creator rate limit.
  const rateKey = `ai_describe:${user.id}`;
  const rate = checkRateLimit(
    rateKey,
    AI_DESCRIBE_MAX,
    AI_DESCRIBE_WINDOW_MS
  );
  if (!rate.allowed) {
    const retryMinutes = Math.ceil(rate.retryAfterMs / 60000);
    return apiError(
      `Too many AI requests. Try again in ${retryMinutes} minute${
        retryMinutes === 1 ? "" : "s"
      }.`,
      429
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    console.warn("[ai/describe] ANTHROPIC_API_KEY not set");
    return apiError(
      "AI drafting is temporarily unavailable. You can still type a description manually.",
      503
    );
  }

  const model = getAnthropicModel();
  const userPromptText = buildUserPrompt({ kind, starter, hint, context });

  // Message content: image blocks first (so the model sees what it's
  // describing before it reads our instructions), then the user prompt.
  const messageContent: Array<
    | { type: "image"; source: { type: "url"; url: string } }
    | { type: "text"; text: string }
  > = [];
  for (const url of imageUrls) {
    messageContent.push({
      type: "image",
      source: { type: "url", url },
    });
  }
  messageContent.push({ type: "text", text: userPromptText });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let outputTokens = 0;
      let inputTokens = 0;

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const anthStream = client.messages.stream({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: messageContent as any,
            },
          ],
        });

        for await (const event of anthStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "delta", text: event.delta.text });
          }
        }

        const final = await anthStream.finalMessage();
        inputTokens = final.usage.input_tokens;
        outputTokens = final.usage.output_tokens;

        send({ type: "done" });
      } catch (err) {
        console.error("[ai/describe] stream error:", err);
        // Emit an error frame so the client can commit partial text and
        // surface a toast. We still close the stream cleanly.
        send({
          type: "error",
          message:
            "The AI draft was interrupted. Your description is saved — feel free to keep editing.",
        });
      } finally {
        const latencyMs = Date.now() - started;
        console.log(
          `[ai/describe] kind=${kind} uid=${user.id} input=${inputTokens} output=${outputTokens} latency=${latencyMs}ms`
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx/Netlify proxy buffering
    },
  });
}
