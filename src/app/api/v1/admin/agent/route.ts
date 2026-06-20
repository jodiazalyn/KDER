import { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import { getAdminContext } from "@/lib/loaders/auth";
import { ADMIN_AGENT_SYSTEM_PROMPT } from "@/lib/admin/agent-prompt";
import { ADMIN_AGENT_TOOLS, runAdminTool } from "@/lib/admin/agent-tools";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/v1/admin/agent
 *
 * The Super Dashboard "Ask-the-data" analyst. Admin-only. Streams an
 * agentic, tool-using response via Server-Sent Events:
 *   1. The model receives the cofounder's question + the search tools.
 *   2. When it decides to search, we run the tool against the service-role
 *      client (real DB reads), stream the resulting CARDS straight to the
 *      cofounder's screen, and feed a slim text projection back to the model.
 *   3. The model loops (search → narrate) until it has an answer, then we
 *      send `done`.
 *
 * Cards are always derived from real query rows — never from model output —
 * so the cofounder can trust the surfaced plate/creator is a real record.
 *
 * SSE frame types:
 *   - { type: "delta", text }            assistant text chunk
 *   - { type: "tool_use_start", tool }   model started a search
 *   - { type: "tool_use_end" }           a content block finished
 *   - { type: "cards", kind, items }     real result cards to render
 *   - { type: "done" }                   stream complete
 *   - { type: "error", message, ... }    fatal error
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 1200;
const MAX_HISTORY_TURNS = 20;
const MAX_MESSAGE_CHARS = 4000;
// Hard cap on search → narrate cycles so a confused model can't loop forever.
const MAX_TOOL_ROUNDS = 5;

// Image attachments (paste/drag screenshots, e.g. a competitor's menu). We
// pass them straight through to the model as base64 — no storage. Keep the
// guardrails tight so a huge paste can't blow up the request.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGES_PER_MESSAGE = 4;
// ~5MB raw ≈ 6.8M base64 chars; allow a little headroom over that.
const MAX_IMAGE_B64_CHARS = 7_200_000;

// Admins are a known, trusted handful — generous cap, just abuse insurance.
const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type TextBlockInput = { type: "text"; text: string };
type ImageBlockInput = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ContentBlockInput = TextBlockInput | ImageBlockInput;

interface ChatMessage {
  role: "user" | "assistant";
  // A plain string (typed/spoken text) or a block array carrying images.
  content: string | ContentBlockInput[];
}

interface RequestBody {
  messages: ChatMessage[];
}

function isValidRole(v: unknown): v is "user" | "assistant" {
  return v === "user" || v === "assistant";
}

/**
 * Normalize one message's content. Strings are trimmed/clamped; block arrays
 * keep valid text + image blocks (right media type, non-empty, under the size
 * cap, at most MAX_IMAGES_PER_MESSAGE). Returns null when nothing usable is
 * left so the caller can drop the message.
 */
function sanitizeContent(
  content: unknown
): string | ContentBlockInput[] | null {
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
  // The model behaves best with a text block alongside the image(s); supply a
  // default instruction when the cofounder sent a screenshot with no caption.
  if (!hasText) {
    blocks.unshift({ type: "text", text: "Analyze the attached image(s)." });
  }
  return blocks;
}

export async function POST(request: NextRequest) {
  // Gate first — never reveal this route exists to non-admins.
  const admin = await getAdminContext();
  if (!admin) {
    return apiError("Not authorized.", 403);
  }

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

  if (
    sanitized.length === 0 ||
    sanitized[sanitized.length - 1].role !== "user"
  ) {
    return apiError("Last message must be from the user.", 400);
  }

  const rate = checkRateLimit(
    `admin_agent:user:${admin.user.id}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rate.allowed) {
    const retryMinutes = Math.ceil(rate.retryAfterMs / 60000);
    return apiError(
      `Slow down — try again in ${retryMinutes} minute${
        retryMinutes === 1 ? "" : "s"
      }.`,
      429
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    console.warn("[admin-agent] ANTHROPIC_API_KEY not set");
    return apiError(
      "The data analyst is temporarily offline. Try again in a few minutes.",
      503
    );
  }
  const model = getAnthropicModel();
  const service = admin.service;

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

      // Running conversation passed to the model. Starts as the
      // sanitized chat history; we append assistant tool_use turns and
      // user tool_result turns as the loop runs.
      const messages: Anthropic.MessageParam[] = sanitized.map((m) => ({
        role: m.role,
        // string | (text|image blocks) — both are valid MessageParam content;
        // the image block's media_type is a literal union upstream, so cast.
        content: m.content as Anthropic.MessageParam["content"],
      }));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const anthStream = client.messages.stream({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: ADMIN_AGENT_SYSTEM_PROMPT,
            messages,
            // The const tool defs satisfy the runtime; the SDK's Tool
            // type is stricter than our literal array, so cast through.
            tools: ADMIN_AGENT_TOOLS as unknown as Anthropic.Tool[],
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

          if (final.stop_reason !== "tool_use") {
            // Model is done — no more searches requested.
            break;
          }

          // Record the assistant turn (text + tool_use blocks) verbatim
          // so the follow-up tool_result lines up with the right ids.
          messages.push({ role: "assistant", content: final.content });

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            toolCalls++;
            let forModel: string;
            try {
              const result = await runAdminTool(
                tu.name,
                (tu.input ?? {}) as Record<string, unknown>,
                service
              );
              // Stream real cards to the screen immediately.
              send({
                type: "cards",
                kind: result.kind,
                items: result.items,
              });
              forModel = result.forModel;
            } catch (toolErr) {
              console.error("[admin-agent] tool failed:", tu.name, toolErr);
              forModel = `Tool ${tu.name} failed to run.`;
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: forModel,
            });
          }

          // Feed the slim text projections back so the model can narrate.
          messages.push({ role: "user", content: toolResults });
          // Loop again; the next round lets the model summarize or
          // refine with another search.
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
        console.error("[admin-agent] stream error:", {
          name: e?.name,
          status: errStatus,
          code: errCode,
          message: e?.error?.message ?? e?.message,
        });
        send({
          type: "error",
          message:
            "The analyst got cut off mid-response. Try sending your question again.",
          code: errCode,
          status: errStatus,
        });
      } finally {
        const latencyMs = Date.now() - started;
        console.log(
          `[admin-agent] admin=${admin.user.id} tools=${toolCalls} input=${inputTokens} output=${outputTokens} latency=${latencyMs}ms`
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
