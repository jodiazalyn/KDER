import { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import { PRICING_AGENT_SYSTEM_PROMPT } from "@/lib/anthropic/pricing-agent-prompt";

/**
 * POST /api/v1/ai/pricing-agent
 *
 * Streams a Pricing Coach response via Server-Sent Events. Mirrors the
 * /api/v1/ai/describe pattern but:
 *   - allows anonymous callers (the whole point is to let visitors
 *     try the agent before signing up)
 *   - takes a full message history (multi-turn chat, not single-shot)
 *   - hands the model a web_search tool so it can pull live grocery
 *     prices when the user asks about a specific store
 *   - persists the final assistant message into pricing_chats when
 *     the caller is logged in and supplies a conversation_id
 *
 * Rate limits are stricter for anon users than authed because we can
 * only key by IP and IPs are shared (NAT, VPNs); authed creators get
 * a higher cap because they're a known person on a Stripe-verified
 * account.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Output budget — coach responses are conversational, not essays.
// 1500 tokens is roughly 6 paragraphs + a small table.
const MAX_OUTPUT_TOKENS = 1500;

// History cap — protect token budget. Send the system prompt + the
// most recent N turns; older context falls off. The client can
// reconstruct the full transcript from its own state for display.
const MAX_HISTORY_TURNS = 20;
const MAX_MESSAGE_CHARS = 4000;

const RATE_LIMIT_ANON_MAX = 30;
const RATE_LIMIT_AUTHED_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  /** Existing pricing_chats row id, when continuing a saved chat.
   *  Only honored for authed users. */
  conversationId?: string;
}

function isValidRole(v: unknown): v is "user" | "assistant" {
  return v === "user" || v === "assistant";
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

  // Sanitize message history: drop anything not matching the expected
  // shape, cap each message length, cap total turns.
  const sanitized: ChatMessage[] = body.messages
    .filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === "object" &&
        isValidRole((m as ChatMessage).role) &&
        typeof (m as ChatMessage).content === "string" &&
        (m as ChatMessage).content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }))
    .slice(-MAX_HISTORY_TURNS);

  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
    return apiError("Last message must be from the user.", 400);
  }

  // Resolve caller identity. Logged-in = member id. Anonymous = IP.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;
  // x-forwarded-for is set by Netlify; fall back to a stable label so
  // the rate limiter has *something* to key on for purely-local dev.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous-no-ip";

  const rateKey = isAuthed
    ? `pricing_agent:user:${user.id}`
    : `pricing_agent:ip:${ip}`;
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
    console.warn("[pricing-agent] ANTHROPIC_API_KEY not set");
    return apiError(
      "The pricing coach is temporarily offline. Try again in a few minutes.",
      503
    );
  }
  const model = getAnthropicModel();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let inputTokens = 0;
      let outputTokens = 0;
      let fullAssistantText = "";

      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const anthStream = client.messages.stream({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: PRICING_AGENT_SYSTEM_PROMPT,
          messages: sanitized,
          // Native web search — only the assistant decides when to
          // actually call it. The system prompt instructs it to use
          // sparingly (only when the user asks about specific stores
          // or live prices).
          // SDK version 0.91 doesn't yet ship a type for the
          // server-tool block; the runtime accepts it, so a cast
          // through unknown satisfies TS without faking the SDK type.
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });

        for await (const event of anthStream) {
          // Text chunks — the bread and butter, stream them through
          // so the client can render character-by-character.
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "delta", text: event.delta.text });
            fullAssistantText += event.delta.text;
            continue;
          }
          // Tool-use start — surface as a status line so the client
          // can show "🔎 Looking up prices..." while we wait. Different
          // tool types could surface different labels later.
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
          // Tool-use complete — clear the status line so the next
          // chunk of text bubbles in clean.
          if (
            event.type === "content_block_stop"
          ) {
            send({ type: "tool_use_end" });
            continue;
          }
        }

        const final = await anthStream.finalMessage();
        inputTokens = final.usage.input_tokens;
        outputTokens = final.usage.output_tokens;

        // Persist on completion if the caller is authed AND supplied
        // (or we should mint) a conversation_id. Best-effort — failure
        // here doesn't fail the stream.
        if (isAuthed && fullAssistantText.trim().length > 0) {
          await persistChat({
            supabase,
            memberId: user.id,
            conversationId: body.conversationId,
            messages: [
              ...sanitized,
              { role: "assistant", content: fullAssistantText },
            ],
            send,
          });
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
        const errMessage =
          e?.error?.message ||
          (typeof e?.message === "string" ? e.message : undefined);
        console.error("[pricing-agent] stream error:", {
          authed: isAuthed,
          name: e?.name,
          status: errStatus,
          code: errCode,
          message: errMessage,
        });
        send({
          type: "error",
          message:
            "The coach got cut off mid-response. Try sending your message again.",
          code: errCode,
          status: errStatus,
        });
      } finally {
        const latencyMs = Date.now() - started;
        console.log(
          `[pricing-agent] authed=${isAuthed} input=${inputTokens} output=${outputTokens} latency=${latencyMs}ms`
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

/** Insert a new pricing_chats row (when no conversationId provided)
 *  or update an existing one. Sends a `conversation_id` SSE frame
 *  so the client can capture the id for future turns. */
async function persistChat(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  memberId: string;
  conversationId?: string;
  messages: ChatMessage[];
  send: (data: unknown) => void;
}) {
  const { supabase, memberId, conversationId, messages, send } = args;
  try {
    if (conversationId) {
      await supabase
        .from("pricing_chats")
        .update({
          messages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("member_id", memberId);
      send({ type: "conversation_id", id: conversationId });
    } else {
      // Title = first 40 chars of the user's opening message.
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = (firstUserMsg?.content ?? "Untitled chat")
        .trim()
        .slice(0, 40);
      const { data, error } = await supabase
        .from("pricing_chats")
        .insert({
          member_id: memberId,
          title,
          messages,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (data?.id) {
        send({ type: "conversation_id", id: data.id });
      }
    }
  } catch (err) {
    console.error("[pricing-agent] persist failed:", err);
    // Don't escalate — chat still works without DB persistence.
  }
}
