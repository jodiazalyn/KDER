"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Loader2, Search, History, X, Save } from "lucide-react";
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
// Where we stash an anonymous transcript between visits so closing
// the tab doesn't nuke it. Auto-imported into pricing_chats when
// the user signs up (see useEffect in PricingAgentClient).
const ANON_CHAT_STORAGE_KEY = "kder_pricing_chat_anon";

interface Props {
  isAuthed: boolean;
  /** When true, the client is being rendered inside a host Sheet/
   *  Dialog at the app-shell level. Skips the route-page slide-up
   *  animation + dialog ARIA wrapper (the host already provides one),
   *  and the X close button calls `onClose` instead of router.back. */
  embedded?: boolean;
  /** Called when the user taps X. In embedded mode the host closes
   *  its sheet; in page mode (default) we fall back to router.back. */
  onClose?: () => void;
  /** Optional one-shot seed for the input box — used by inline
   *  triggers ("Help me price my brisket plates") so the user can
   *  send-as-is or edit before sending. Consumed on first apply. */
  seedInput?: string;
}

export function PricingAgentClient({
  isAuthed,
  embedded = false,
  onClose,
  seedInput,
}: Props) {
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

  // ── Anon transcript persistence ──────────────────────────────
  // Closing the tab used to lose everything. Now we mirror the
  // transcript to localStorage on every change while anon, and
  // restore on mount if it's still there.
  //
  // The restore-on-mount runs once and is guarded by isAuthed because
  // a signed-in user has DB-backed chats; we don't want to mix the
  // two stores.
  useEffect(() => {
    if (isAuthed) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ANON_CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      // Same shape filter as the API — defends against schema drift.
      const restored: ChatMessage[] = parsed.filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          (((m as ChatMessage).role === "user") ||
            (m as ChatMessage).role === "assistant") &&
          typeof (m as ChatMessage).content === "string"
      );
      if (restored.length > 0) setMessages(restored);
    } catch {
      // Corrupted blob — clear it so we don't keep failing.
      window.localStorage.removeItem(ANON_CHAT_STORAGE_KEY);
    }
    // Intentional: run once on mount only. Re-running on isAuthed flip
    // is handled by the import effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write-through on every transcript change while anon.
  useEffect(() => {
    if (isAuthed) return;
    if (typeof window === "undefined") return;
    if (messages.length === 0) return;
    try {
      window.localStorage.setItem(
        ANON_CHAT_STORAGE_KEY,
        JSON.stringify(messages)
      );
    } catch {
      // Quota exceeded — silently give up. Worst case we lose the
      // chat on tab close, which is the status quo.
    }
  }, [messages, isAuthed]);

  // ── Auto-import on signup ────────────────────────────────────
  // When a previously-anon visitor finishes signup and lands back
  // here, isAuthed flips to true. If we still have a localStorage
  // chat AND no conversationId, persist it to a new pricing_chats
  // row and clear the local copy.
  useEffect(() => {
    if (!isAuthed) return;
    if (conversationId) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ANON_CHAT_STORAGE_KEY);
    if (!raw) return;

    let parsed: ChatMessage[] = [];
    try {
      parsed = JSON.parse(raw) ?? [];
    } catch {
      window.localStorage.removeItem(ANON_CHAT_STORAGE_KEY);
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.removeItem(ANON_CHAT_STORAGE_KEY);
      return;
    }

    // Fire and forget — if it fails the user can re-send their next
    // message and persistence kicks in via the streaming endpoint.
    (async () => {
      try {
        const res = await fetch("/api/v1/ai/pricing-agent/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: parsed }),
        });
        if (!res.ok) return;
        const body = await res.json();
        const chat = body?.data?.chat;
        if (chat?.id) {
          setConversationId(chat.id);
          setMessages(parsed);
          // Re-load the past-chats list next time the drawer opens so
          // the newly-imported chat shows up.
          setPastChats(null);
          toast.success("Saved your chat to your account.");
        }
        window.localStorage.removeItem(ANON_CHAT_STORAGE_KEY);
      } catch {
        // Network blip — leave the localStorage copy in place so we
        // can retry on next mount.
      }
    })();
  }, [isAuthed, conversationId]);

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

  // Close action — when embedded in a host sheet, defer to that host
  // (it knows how to animate the sheet out). In standalone /pricing-
  // agent mode, pop back if there's browser history, otherwise route
  // to the landing page.
  const handleClose = useCallback(() => {
    if (embedded && onClose) {
      onClose();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [embedded, onClose, router]);

  // Escape-to-close — only attach in standalone mode. The host Sheet
  // primitive already handles Escape when embedded, and attaching here
  // too would close + double-fire.
  useEffect(() => {
    if (embedded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, handleClose]);

  // Seed-input pre-fill. Inline triggers ("Ask the coach about
  // pricing") pass a contextual prompt; we drop it into the input so
  // the user can send-as-is or tweak. Only applies when the chat is
  // fresh + the input is empty — never clobber what the user typed.
  const lastSeedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!seedInput) return;
    if (seedInput === lastSeedRef.current) return;
    lastSeedRef.current = seedInput;
    setInput((prev) => (prev.trim() ? prev : seedInput));
    // Focus the input so the user can send immediately. Defer one
    // frame so the textarea has mounted (esp. inside a sheet that's
    // mid-open-animation).
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [seedInput]);

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
        // Slide-up animation only when standalone — the host Sheet
        // primitive already animates when embedded.
        !embedded &&
          "animate-in slide-in-from-bottom duration-[380ms] ease-out"
      )}
      // Skip dialog/modal ARIA when embedded — the host already
      // provides them and nesting two breaks the screen-reader tree.
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-label={embedded ? undefined : "Pricing coach"}
    >
      {/* Sheet header — Mia's identity on the left, the secondary
          action (Past chats for authed / Save chat for anon) in the
          middle, X close on the right (sheet convention).
          The X is rendered locally in BOTH standalone + embedded
          modes — the host Sheet's built-in close has low contrast on
          this dark surface, so PricingCoachProvider hides it via the
          `[&>button.absolute]:hidden` selector on SheetContent.
          `shrink-0` on every fixed-width child guarantees the title
          is the only thing that truncates on narrow viewports. */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-3 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <KderMark size={32} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-white">
              Mia
            </h1>
            <p className="truncate text-[11px] text-white/45">
              Your KDER concierge
            </p>
          </div>
        </div>
        {isAuthed ? (
          <button
            type="button"
            onClick={() => setPastChatsOpen(true)}
            aria-label="Past chats with Mia"
            className="glass-btn-pill flex h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-white/70 hover:text-white active:scale-95"
          >
            <History size={14} />
            Past
          </button>
        ) : (
          // Anon visitors — always-visible "Save chat" entry point.
          // Lands them on signup, then returns here, where the auto-
          // import effect persists their localStorage transcript.
          <Link
            href="/signup?returnTo=%2Fpricing-agent"
            aria-label="Save chat — sign up"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#1B5E20] px-3 text-xs font-bold text-white shadow-[0_0_12px_rgba(27,94,32,0.4)] transition-transform active:scale-95"
          >
            <Save size={14} />
            Save
          </Link>
        )}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close Mia"
          // 40×40 tap target. High-contrast chip — explicit ring + a
          // brighter background than the radix default so the X reads
          // clearly against the dark substrate at any viewport width.
          // Shrink-0 guarantees it's never squeezed out by the chip.
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset] backdrop-blur-sm transition-all hover:bg-white/30 active:scale-90"
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
          Hey, I&apos;m Mia.
        </h2>
        <p className="mt-1.5 text-sm text-white/60">
          I help home cooks get set up on KDER, sharpen
          their plate listings, price their food, and land their first
          orders. Tell me what you&apos;re working on.
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
  // Assistant: parse the content into Canva-style card modules.
  // Sections (## ✨ ...), shopping-list lines (- 🍗 name — $X), totals,
  // hero prices, and free-text paragraphs each render as styled blocks
  // designed to look screenshot-able for Gen Z / female creators.
  return (
    <div className="flex items-start gap-2">
      <KderMark size={32} />
      <div className="min-w-0 max-w-[88%] flex-1 space-y-3">
        {content ? (
          <AssistantResponse content={content} />
        ) : (
          <span className="text-white/30">…</span>
        )}
      </div>
    </div>
  );
}

// ── Assistant response renderer ──────────────────────────────────
// Parses our agreed markdown shape into card modules. Format the
// agent emits is documented in src/lib/anthropic/pricing-agent-prompt.ts.
//
// We're not using react-markdown intentionally — the format we emit
// is narrow and predictable, and a custom renderer lets us style
// each pattern as a real designed component (shopping-list row with
// price pill, hero price card, etc.) instead of a generic <ul>/<table>.

interface Block {
  kind: "section" | "paragraph";
  heading?: string; // section only — full "## ✨ What you'll need"
  lines: string[];  // paragraph: each line; section: child content lines
}

/** Walk the streamed text into blocks. Top-level grouping: each `## `
 *  starts a new section; everything between sections (or at the top)
 *  is a paragraph block. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("## ")) {
      // Push previous block if it had content
      if (current && (current.heading || current.lines.length > 0)) {
        blocks.push(current);
      }
      current = { kind: "section", heading: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (!current) {
      current = { kind: "paragraph", lines: [] };
    }
    if (current.kind === "paragraph" && line.trim() === "") {
      // Blank line within paragraph block — flush and start a new one
      if (current.lines.length > 0) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    current.lines.push(line);
  }
  if (current && (current.heading || current.lines.length > 0)) {
    blocks.push(current);
  }
  return blocks;
}

function AssistantResponse({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <>
      {blocks.map((block, idx) =>
        block.kind === "section" ? (
          <SectionCard key={idx} heading={block.heading ?? ""} lines={block.lines} />
        ) : (
          <ProseBlock key={idx} lines={block.lines} />
        )
      )}
    </>
  );
}

/** Styled wrapper for a `## ✨ ...` section. The heading emoji + text
 *  sit in a soft pill at the top; the body is parsed line-by-line
 *  into shopping-list rows, total rows, hero prices, or prose. */
function SectionCard({ heading, lines }: { heading: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-b from-amber-50/[0.04] to-white/[0.02] p-4 shadow-[0_2px_18px_rgba(0,0,0,0.25)]">
      {heading && (
        <h3 className="mb-3 text-[15px] font-bold tracking-tight text-white">
          {heading}
        </h3>
      )}
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <LineRenderer key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

/** Free-text paragraph block — between or before sections. Bold spans
 *  rendered in kder-green for warmth. */
function ProseBlock({ lines }: { lines: string[] }) {
  const text = lines.join("\n").trim();
  if (!text) return null;
  // Strip leading "---" separators the model sometimes emits.
  if (/^-{3,}$/.test(text)) return null;
  return (
    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-white/85">
      {renderInline(text)}
    </p>
  );
}

/** One line inside a section. Detects the patterns we agreed in the
 *  prompt and dispatches to the right styled component. */
function LineRenderer({ line }: { line: string }) {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  // Hero price: **$14 per plate** alone on a line → big display.
  const heroMatch = trimmed.match(/^\*\*\$(\d+(?:\.\d+)?)\s+(.+?)\*\*$/);
  if (heroMatch) {
    return <HeroPrice amount={heroMatch[1]} unit={heroMatch[2]} />;
  }

  // Total row: **Total: $X** or **Total cost: $X**
  const totalMatch = trimmed.match(/^\*\*(Total[^:]*):\s*\$(\d+(?:\.\d+)?)\*\*$/i);
  if (totalMatch) {
    return <TotalRow label={totalMatch[1]} amount={totalMatch[2]} />;
  }

  // Shopping-list line: - 🍗 Chicken thighs — $12.50
  // The em-dash is what the agent uses; tolerate -- and - too.
  const listMatch = trimmed.match(
    /^-\s+(.+?)\s+(?:—|--|-)\s*\$(\d+(?:\.\d+)?)\s*$/
  );
  if (listMatch) {
    return <ShoppingListRow body={listMatch[1]} price={listMatch[2]} />;
  }

  // Plain list line without a price → simple bullet
  const plainListMatch = trimmed.match(/^-\s+(.+)$/);
  if (plainListMatch) {
    return (
      <div className="flex items-start gap-2 text-[14px] text-white/80">
        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
        <span>{renderInline(plainListMatch[1])}</span>
      </div>
    );
  }

  // Fall-through: render as inline prose inside the section.
  return (
    <p className="text-[14px] leading-relaxed text-white/75">
      {renderInline(trimmed)}
    </p>
  );
}

/** A single shopping-list row — leading emoji + name on the left,
 *  price pill on the right. Auto-detects the emoji from the line's
 *  first grapheme. */
function ShoppingListRow({ body, price }: { body: string; price: string }) {
  // Split the leading emoji (if any) off the body for visual treatment.
  // Emoji can be multi-codepoint; this is "first grapheme that isn't
  // ASCII letter/digit." Good enough for the formats the prompt asks
  // the agent to emit.
  let emoji = "";
  let name = body;
  // Match a leading non-ASCII char (and any combining marks / VS-16).
  const emojiMatch = body.match(/^([^\w\s][‍️⃣]*[\p{Extended_Pictographic}]*[‍️⃣]*)\s+/u);
  if (emojiMatch) {
    emoji = emojiMatch[1];
    name = body.slice(emojiMatch[0].length);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      {emoji && (
        <span className="text-xl leading-none" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[14px] text-white/90">
        {name}
      </span>
      <span className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-1 text-[12px] font-bold tabular-nums text-green-300 ring-1 ring-inset ring-green-400/30">
        ${price}
      </span>
    </div>
  );
}

/** Totals row inside a section — emphasized version of ShoppingListRow.
 *  Sits below the regular items with a subtle separator above. */
function TotalRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 border-t border-white/[0.08] pt-3">
      <span className="flex-1 text-[14px] font-bold text-white">{label}</span>
      <span className="rounded-full bg-green-500/25 px-3 py-1 text-[13px] font-black tabular-nums text-green-200 ring-1 ring-inset ring-green-400/40">
        ${amount}
      </span>
    </div>
  );
}

/** Hero price — the "what to charge" payoff. Big, bold, designed to
 *  feel like the screenshottable money line. */
function HeroPrice({ amount, unit }: { amount: string; unit: string }) {
  return (
    <div className="my-2 rounded-2xl bg-gradient-to-br from-green-500/25 via-green-500/15 to-emerald-500/10 px-4 py-5 text-center ring-1 ring-inset ring-green-400/40">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-2xl font-bold text-green-200/90">$</span>
        <span className="text-5xl font-black leading-none tracking-tight text-green-200 tabular-nums">
          {amount}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-green-200/70">
        {unit}
      </p>
    </div>
  );
}

/** Inline rendering for **bold** spans + inline $X.XX prices. Keeps
 *  paragraphs lively without turning into a full markdown parser. */
function renderInline(text: string): React.ReactNode {
  // Pattern matches **bold** OR a dollar amount ($12 / $12.50). Whatever
  // doesn't match passes through as plain text.
  const pattern = /(\*\*[^*]+\*\*)|(\$\d+(?:\.\d{1,2})?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Bold span
      parts.push(
        <strong key={key++} className="font-bold text-green-200">
          {match[1].slice(2, -2)}
        </strong>
      );
    } else if (match[2]) {
      // Inline price → soft pill
      parts.push(
        <span
          key={key++}
          className="mx-0.5 rounded-full bg-green-500/12 px-1.5 py-0.5 text-[12.5px] font-bold tabular-nums text-green-300 ring-1 ring-inset ring-green-400/20"
        >
          {match[2]}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
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
