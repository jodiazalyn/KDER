import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/env";
import { CONCIERGE_SYSTEM_PROMPT } from "@/lib/concierge/concierge-prompt";
import { CONCIERGE_TOOLS, runConciergeTool } from "@/lib/concierge/concierge-tools";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/v1/ai/concierge
 *
 * The PUBLIC storefront concierge — "Drive Thru". Any visitor (anon or
 * authed) can talk/type to it from a creator's storefront. It streams an
 * agentic, tool-using response via Server-Sent Events:
 *   1. The model receives the visitor's message (text and/or food photos)
 *      plus the customer-safe `search_plates` tool.
 *   2. When it searches, we run the tool against an ANON Supabase client
 *      (public RLS only — live + storefront-active plates), stream the
 *      resulting plate CARDS straight to the screen, and feed a slim text
 *      projection back to the model.
 *   3. The model loops (search → coach) until done, then we send `done`.
 *
 * Cards always come from real query rows — never model output — so every
 * plate the visitor can tap to order is a real, orderable record. Each card
 * carries its creator handle so the client can bridge a pick into that
 * creator's existing order flow.
 *
 * Mirrors the admin analyst route (`/api/v1/admin/agent`) but: no admin gate
 * (public), IP-keyed rate limiting for anon callers, and the anon client +
 * customer-safe tool set instead of the service-role client.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 1000;
const MAX_HISTORY_TURNS = 16;
const MAX_MESSAGE_CHARS = 3000;
// Hard cap on search → coach cycles so a confused model can't loop forever.
const MAX_TOOL_ROUNDS = 4;

// Food photos: passed straight to the model as base64, no storage.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGES_PER_MESSAGE = 3;
// ~5MB raw ≈ 6.8M base64 chars; allow a little headroom.
const MAX_IMAGE_B64_CHARS = 7_200_000;

// Public route — anon is keyed by IP (shared via NAT/VPN, so keep it tight);
// authed visitors get a higher cap.
const RATE_LIMIT_ANON_MAX = 30;
const RATE_LIMIT_AUTHED_MAX = 80;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type TextBlockInput = { type: "text"; text: string };
type ImageBlockInput = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ContentBlockInput = TextBlockInput | ImageBlockInput;

interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlockInput[];
}

interface RequestBody {
  messages: ChatMessage[];
}

function isValidRole(v: unknown): v is "user" | "assistant" {
  return v === "user" || v === "assistant";
}

/** Anon Supabase client — no cookies, public RLS only. The concierge tools
 *  read strictly public rows (active listings on live storefronts), so anon
 *  access is exactly the right scope. */
function createAnonClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Normalize one message's content. Strings are trimmed/clamped; block arrays
 * keep valid text + image blocks. Returns null when nothing usable is left.
 */
function sanitizeContent(content: unknown): string | ContentBlockInput[] | null {
  if (typeof content === "string") {
    const t = content.trim();
    return t.length > 0 ? t.slice(0, MAX_MESSAGE_CHARS) : null;
  }
  if (!Array.isArray(content)) return null;

  const blocks: ContentBlockInput[] = [];
  let images = 0;
  let hasText = false;
  for (const raw of content) {
    if (raw == null || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      const t = block.text.trim();
      if (t.length > 0) {
        blocks.push({ type: "text", text: t.slice(0, MAX_MESSAGE_CHARS) });
        hasText = true;
      }
    } else if (
      block.type === "image" &&
      block.source != null &&
      typeof block.source === "object"
    ) {
      if (images >= MAX_IMAGES_PER_MESSAGE) continue;
      const src = block.source as Record<string, unknown>;
      if (
        src.type === "base64" &&
        typeof src.media_type === "string" &&
        ALLOWED_IMAGE_TYPES.has(src.media_type) &&
        typeof src.data === "string" &&
        src.data.length > 0 &&
        src.data.length <= MAX_IMAGE_B64_CHARS
      ) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: src.media_type,
            data: src.data,
          },
        });
        images++;
      }
    }
  }

  if (blocks.length === 0) return null;
  if (!hasText) {
    blocks.unshift({
      type: "text",
      text: "Here's a photo of a dish — tell me about its nutrition and find me something like it on KDER.",
    });
  }
  return blocks;
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return apiError("messages array is required.", 400);
  }

  const sanitized: ChatMessage[] = (body.messages as unknown[])
    .filter(
      (m): m is { role: "user" | "assistant"; content: unknown } =>
        m != null &&
        typeof m === "object" &&
        isValidRole((m as { role: unknown }).role)
    )
    .map((m) => ({ role: m.role, content: sanitizeContent(m.content) }))
    .filter((m): m is ChatMessage => m.content !== null)
    .slice(-MAX_HISTORY_TURNS);

  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
    return apiError("Last message must be from the user.", 400);
  }

  // Resolve caller identity for rate-limit keying. Authed = member id;
  // anon = IP. The tool reads themselves always run on the anon client.
  const { createClient } = await import("@/lib/supabase/server");
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  const isAuthed = !!user;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous-no-ip";
  const rateKey = isAuthed
    ? `concierge:user:${user.id}`
    : `concierge:ip:${ip}`;
  const rateCap = isAuthed ? RATE_LIMIT_AUTHED_MAX : RATE_LIMIT_ANON_MAX;
  const rate = checkRateLimit(rateKey, rateCap, RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    const retryMinutes = Math.ceil(rate.retryAfterMs / 60000);
    return apiError(
      `Whoa — slow down. Try again in ${retryMinutes} minute${
        retryMinutes === 1 ? "" : "s"
      }.`,
      429
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    console.warn("[concierge] ANTHROPIC_API_KEY not set");
    return apiError(
      "Drive Thru is taking a quick break. Try again in a few minutes.",
      503
    );
  }
  const model = getAnthropicModel();
  const anon = createAnonClient();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let inputTokens = 0;
      let outputTokens = 0;
      let toolCalls = 0;

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const messages: Anthropic.MessageParam[] = sanitized.map((m) => ({
        role: m.role,
        content: m.content as Anthropic.MessageParam["content"],
      }));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const anthStream = client.messages.stream({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: CONCIERGE_SYSTEM_PROMPT,
            messages,
            tools: CONCIERGE_TOOLS as unknown as Anthropic.Tool[],
          });

          for await (const event of anthStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "delta", text: event.delta.text });
              continue;
            }
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              send({
                type: "tool_use_start",
                tool: event.content_block.name ?? "tool",
              });
              continue;
            }
            if (event.type === "content_block_stop") {
              send({ type: "tool_use_end" });
              continue;
            }
          }

          const final = await anthStream.finalMessage();
          inputTokens += final.usage.input_tokens;
          outputTokens += final.usage.output_tokens;

          if (final.stop_reason !== "tool_use") break;

          messages.push({ role: "assistant", content: final.content });

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            toolCalls++;
            let forModel: string;
            try {
              const result = await runConciergeTool(
                tu.name,
                (tu.input ?? {}) as Record<string, unknown>,
                anon
              );
              send({ type: "cards", kind: result.kind, items: result.items });
              forModel = result.forModel;
            } catch (toolErr) {
              console.error("[concierge] tool failed:", tu.name, toolErr);
              forModel = `Tool ${tu.name} failed to run.`;
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: forModel,
            });
          }

          messages.push({ role: "user", content: toolResults });
        }

        send({ type: "done" });
      } catch (err) {
        const e = err as {
          name?: string;
          status?: number;
          code?: string;
          message?: string;
          error?: { type?: string; message?: string };
        };
        const errStatus = typeof e?.status === "number" ? e.status : undefined;
        const errCode =
          (typeof e?.code === "string" && e.code) ||
          e?.error?.type ||
          e?.name ||
          undefined;
        console.error("[concierge] stream error:", {
          authed: isAuthed,
          name: e?.name,
          status: errStatus,
          code: errCode,
          message: e?.error?.message ?? e?.message,
        });
        send({
          type: "error",
          message:
            "Drive Thru got cut off mid-thought. Try sending that again.",
          code: errCode,
          status: errStatus,
        });
      } finally {
        const latencyMs = Date.now() - started;
        console.log(
          `[concierge] authed=${isAuthed} tools=${toolCalls} input=${inputTokens} output=${outputTokens} latency=${latencyMs}ms`
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
      "X-Accel-Buffering": "no",
    },
  });
}
