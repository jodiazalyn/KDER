"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Loader2, Search, History, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRICING_AGENT_QUICK_STARTS } from "@/lib/anthropic/pricing-agent-prompt";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";

/**
 * KDER Pricing Coach — chat UI.
 *
 * Anon-allowed (the whole point is to let visitors try before
 * signing up). When `isAuthed` is true, transcripts persist to
 * `pricing_chats` via the API; when false they live only in this
 * component's state.
 *
 * After 5 user messages from an anon visitor, a soft "save this
 * chat" banner appears above the input. Dismissible — once dismissed
 * it doesn't reappear this session. The CTA routes through /signup
 * with `?returnTo=/pricing-agent` so the user lands back here after
 * creating their account.
 *
 * Streaming protocol (SSE from /api/v1/ai/pricing-agent):
 *   { type: "delta", text }            → append to current assistant bubble
 *   { type: "tool_use_start", tool }   → render "🔎 Looking up prices..." status
 *   { type: "tool_use_end" }           → clear status
 *   { type: "conversation_id", id }    → capture for subsequent turns
 *   { type: "done" }                   → mark assistant turn complete
 *   { type: "error", message }         → toast + commit partial text
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PastChat {
  id: string;
  title: string;
  updated_at: string;
}

const ANON_SOFT_GATE_TURNS = 5;

interface Props {
  isAuthed: boolean;
}

export function PricingAgentClient({ isAuthed }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  // The id of the persisted DB row, once the first authed exchange
  // returns one. Sent on subsequent turns so the API knows to update
  // rather than insert.
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [gateDismissed, setGateDismissed] = useState(false);
  const [pastChatsOpen, setPastChatsOpen] = useState(false);
  const [pastChats, setPastChats] = useState<PastChat[] | null>(null);

  // Coachmark anchor — fires on first visit to nudge the user toward
  // typing their first message.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content. Defer to the next frame so the
  // newly-mounted message has measurable height first.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, toolStatus]);

  // ── Send a message ────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      // Optimistic user bubble + empty assistant bubble we'll fill
      // as deltas stream in.
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const seedAssistant: ChatMessage = { role: "assistant", content: "" };
      const nextHistory = [...messages, userMsg];
      setMessages([...nextHistory, seedAssistant]);
      setInput("");
      setPending(true);
      setToolStatus(null);

      try {
        const res = await fetch("/api/v1/ai/pricing-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextHistory,
            conversationId: conversationId ?? undefined,
          }),
        });

        if (!res.ok) {
          // Non-streaming error path (rate limit, 503, etc.).
          const body = await res.json().catch(() => ({}));
          toast.error(body?.error || "Something went wrong. Try again.");
          // Drop the empty assistant bubble we seeded.
          setMessages(nextHistory);
          return;
        }

        if (!res.body) {
          toast.error("No response body. Try again.");
          setMessages(nextHistory);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Helper to append to the in-flight assistant bubble.
        const appendDelta = (text: string) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                role: "assistant",
                content: last.content + text,
              };
            }
            return copy;
          });
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames separated by blank lines. Parse what we have.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const dataLine = frame
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(6));
              switch (payload.type) {
                case "delta":
                  if (typeof payload.text === "string") {
                    appendDelta(payload.text);
                  }
                  break;
                case "tool_use_start":
                  setToolStatus(
                    payload.tool === "web_search"
                      ? "Looking up prices…"
                      : "Thinking…"
                  );
                  break;
                case "tool_use_end":
                  setToolStatus(null);
                  break;
                case "conversation_id":
                  if (typeof payload.id === "string") {
                    setConversationId(payload.id);
                  }
                  break;
                case "done":
                  setToolStatus(null);
                  break;
                case "error":
                  toast.error(
                    payload.message || "The coach got interrupted."
                  );
                  setToolStatus(null);
                  break;
              }
            } catch {
              // ignore malformed frames
            }
          }
        }
      } catch {
        toast.error("Couldn't reach the coach. Check your connection.");
        setMessages(nextHistory); // drop the empty assistant bubble
      } finally {
        setPending(false);
        setToolStatus(null);
      }
    },
    [messages, pending, conversationId]
  );

  // ── Past chats drawer ─────────────────────────────────────
  const loadPastChats = useCallback(async () => {
    if (!isAuthed || pastChats !== null) return;
    try {
      const res = await fetch("/api/v1/ai/pricing-agent/chats");
      if (!res.ok) return;
      const body = await res.json();
      setPastChats(body.data?.chats ?? []);
    } catch {
      setPastChats([]);
    }
  }, [isAuthed, pastChats]);

  useEffect(() => {
    if (pastChatsOpen) loadPastChats();
  }, [pastChatsOpen, loadPastChats]);

  const loadChat = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/ai/pricing-agent/chats/${id}`);
      if (!res.ok) {
        toast.error("Couldn't load that chat.");
        return;
      }
      const body = await res.json();
      const chat = body.data?.chat;
      if (chat?.messages) {
        setMessages(chat.messages);
        setConversationId(chat.id);
        setPastChatsOpen(false);
      }
    } catch {
      toast.error("Couldn't load that chat.");
    }
  }, []);

  // ── Soft signup gate ───────────────────────────────────────
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const showGate =
    !isAuthed && !gateDismissed && userMessageCount >= ANON_SOFT_GATE_TURNS;

  // Close action — pops back if there's browser history, otherwise
  // routes to the landing page. Mobile users typically open the
  // agent from the landing CTA, so `router.back()` usually feels
  // right; the fallback covers direct visits.
  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  // Escape-to-close — matches the sheet convention.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  // ── Render ────────────────────────────────────────────────
  // The page is styled like a full-screen sheet — slides up on
  // mount, sticky header with X (top-right, matches Apple sheet
  // convention), no traditional back arrow. Looks identical to a
  // real bottom-sheet modal on mobile but is a real URL so the
  // page is linkable + SEO-able.
  return (
    <div
      className={cn(
        "flex h-[100dvh] flex-col bg-[#0A0A0A]",
        // Slide-up entrance. Uses the same tailwindcss-animate utility
        // suite that the Sheet/Dialog primitives use, so the timing
        // and easing match the rest of the app's bottom sheets.
        "animate-in slide-in-from-bottom duration-[380ms] ease-out"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Pricing coach"
    >
      {/* Sheet header — agent identity on the left, close X on the
          right (sheet convention). No back arrow — close goes back
          or to home, whichever's appropriate. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <KderMark size={28} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-white">
              Pricing coach
            </h1>
            <p className="truncate text-[11px] text-white/40">
              Free · powered by KDER
            </p>
          </div>
        </div>
        {isAuthed && (
          <button
            type="button"
            onClick={() => setPastChatsOpen(true)}
            aria-label="Past chats"
            className="glass-btn-pill flex h-11 items-center gap-1.5 px-3 text-xs font-medium text-white/70 hover:text-white active:scale-95"
          >
            <History size={14} />
            Past
          </button>
        )}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close pricing coach"
          // 44×44 tap target, sheet-X in top-right corner. Slightly
          // brighter affordance than the Past button so the exit
          // surface is obvious — matches the existing close button in
          // src/components/ui/sheet.tsx.
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-90"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 ? (
            <EmptyState
              onPick={(prompt) => {
                setInput(prompt);
                inputRef.current?.focus();
              }}
            />
          ) : (
            messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} />
            ))
          )}
          {toolStatus && (
            <div className="flex items-center gap-2 pl-10 text-xs text-white/50">
              <Search size={12} className="animate-pulse" />
              {toolStatus}
            </div>
          )}
          {pending && messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 pl-10 text-xs text-white/50">
                <Loader2 size={12} className="animate-spin" />
                Thinking…
              </div>
            )}
        </div>
      </div>

      {/* Soft signup gate (only when anon + over the turn cap) */}
      {showGate && (
        <div className="border-t border-amber-400/[0.30] bg-amber-900/[0.20] px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-100">
                Loving this? Save your chat.
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
                Create a free KDER account to keep this conversation
                and unlock publishing your first plate.
              </p>
            </div>
            <Link
              href="/signup?returnTo=%2Fpricing-agent"
              className="shrink-0 rounded-full bg-[#1B5E20] px-4 py-2 text-xs font-bold text-white shadow-[0_0_12px_rgba(27,94,32,0.4)] active:scale-95"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => setGateDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-amber-200/60 hover:bg-amber-500/10 hover:text-amber-100 active:scale-90"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px]">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={
              messages.length === 0
                ? "What are you cooking with today?"
                : "Reply…"
            }
            rows={1}
            className="glass-input min-h-[44px] max-h-32 flex-1 resize-none px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || pending}
            aria-label="Send message"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all active:scale-90",
              input.trim() && !pending
                ? "bg-[#1B5E20] shadow-[0_0_12px_rgba(27,94,32,0.5)]"
                : "cursor-not-allowed bg-white/[0.08] text-white/30"
            )}
          >
            {pending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Past chats drawer */}
      {pastChatsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setPastChatsOpen(false)}
        >
          <div
            className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col border-l border-white/[0.10] bg-[#0A0A0A] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.10] px-4 py-3">
              <h2 className="text-base font-bold text-white">Past chats</h2>
              <button
                type="button"
                onClick={() => setPastChatsOpen(false)}
                aria-label="Close past chats"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-90"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pastChats === null ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              ) : pastChats.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-white/40">
                  No saved chats yet. Start a conversation and it&apos;ll
                  show up here.
                </p>
              ) : (
                <ul className="space-y-1">
                  {pastChats.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => loadChat(c.id)}
                        className="w-full rounded-xl px-3 py-3 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
                      >
                        <p className="line-clamp-1 font-medium">{c.title}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {new Date(c.updated_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* First-visit coachmark on the input. */}
      <Coachmark
        id="pricing-agent-welcome"
        copy={COACHMARK_COPY["pricing-agent-welcome"]}
        targetRef={inputRef as React.RefObject<HTMLElement | null>}
        showDelayMs={800}
      />
    </div>
  );
}

/** Welcome card with quick-start chips. Sits in the message list
 *  when there are no messages yet. */
function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <KderMark size={48} />
      <div className="max-w-md">
        <h2 className="text-lg font-bold text-white">
          Hey, I&apos;m your KDER pricing coach.
        </h2>
        <p className="mt-1.5 text-sm text-white/60">
          Tell me what&apos;s in your fridge or what you&apos;re thinking
          about cooking. I&apos;ll work out what it costs and a fair sell
          price with you.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {PRICING_AGENT_QUICK_STARTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-white/[0.10] bg-white/[0.02] px-3 py-2 text-xs text-white/70 transition-all hover:border-white/[0.25] hover:text-white active:scale-95"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One chat bubble. Assistant bubbles render the KDER brand mark as
 *  the avatar to the left; user bubbles align right with no avatar. */
function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#1B5E20] px-4 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <KderMark size={32} />
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/90">
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {content || <span className="text-white/30">…</span>}
        </p>
      </div>
    </div>
  );
}

/** KDER brand mark with a graceful fallback if the image fails to
 *  load (corrupted asset, ad-blocker, offline). Falls back to a
 *  kder-green pill with the letter K. */
function KderMark({ size }: { size: number }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center rounded-full bg-[#1B5E20] font-black text-white"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        K
      </span>
    );
  }
  return (
    <Image
      src="/brand/mark-green.png"
      alt="KDER"
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className="shrink-0 rounded-full"
    />
  );
}
