"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Mic, ArrowUp, Loader2, Asterisk } from "lucide-react";
import type { PlateCard, CreatorCard } from "@/lib/admin/agent-tools";
import { PlateResultCard, CreatorResultCard } from "./AgentCards";
import { useVoiceInput } from "./useVoiceInput";

/* ────────────────────────────────────────────────────────────────
 * Super Dashboard "Ask-the-data" analyst — styled to look and feel
 * like Claude.ai.
 *
 * Full-screen overlay with a centered conversation column on Claude's
 * warm cream canvas: assistant replies render as plain prose (no bubble)
 * next to the asterisk mark, user turns sit in a soft right-aligned
 * bubble, and the composer is a large rounded card with a circular send
 * button. Streams over SSE from /api/v1/admin/agent; surfaces real
 * plate/creator records as cards inline.
 * ──────────────────────────────────────────────────────────────── */

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "plates"; plates: PlateCard[] }
  | { kind: "creators"; creators: CreatorCard[] };

const SUGGESTIONS = [
  "Creators who have spaghetti meals",
  "Delivery plates under $20",
  "Most popular vegan dishes",
  "Verified creators who need attention",
];

function ClaudeMark({ size = 20 }: { size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#D97757]"
      style={{ width: size + 8, height: size + 8 }}
    >
      <Asterisk size={size} className="text-white" strokeWidth={2.5} />
    </div>
  );
}

export function SuperAgentPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const started = entries.length > 0;

  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || pending) return;

      const userMsg: ApiMessage = { role: "user", content: trimmed };
      const nextHistory = [...history, userMsg];

      setEntries((prev) => [
        ...prev,
        { kind: "user", text: trimmed },
        { kind: "assistant", text: "" },
      ]);
      setInput("");
      setPending(true);
      setToolStatus(null);

      let assistantText = "";

      const appendDelta = (text: string) => {
        assistantText += text;
        setEntries((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.kind === "assistant") {
            copy[copy.length - 1] = {
              kind: "assistant",
              text: last.text + text,
            };
          } else {
            copy.push({ kind: "assistant", text });
          }
          return copy;
        });
      };

      try {
        const res = await fetch("/api/v1/admin/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body?.error || "Something went wrong. Try again.");
          setEntries((prev) => prev.slice(0, -1));
          return;
        }
        if (!res.body) {
          toast.error("No response body. Try again.");
          setEntries((prev) => prev.slice(0, -1));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

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
                  if (typeof payload.text === "string") appendDelta(payload.text);
                  break;
                case "tool_use_start":
                  setToolStatus(
                    payload.tool === "search_plates"
                      ? "Searching plates"
                      : payload.tool === "search_creators"
                        ? "Searching creators"
                        : payload.tool === "get_creator"
                          ? "Looking up creator"
                          : "Searching"
                  );
                  break;
                case "tool_use_end":
                  setToolStatus(null);
                  break;
                case "cards":
                  if (payload.kind === "plates") {
                    setEntries((prev) => [
                      ...prev,
                      { kind: "plates", plates: payload.items ?? [] },
                    ]);
                  } else if (payload.kind === "creators") {
                    setEntries((prev) => [
                      ...prev,
                      { kind: "creators", creators: payload.items ?? [] },
                    ]);
                  }
                  break;
                case "done":
                  setToolStatus(null);
                  break;
                case "error":
                  toast.error(payload.message || "The analyst got interrupted.");
                  setToolStatus(null);
                  break;
              }
            } catch {
              // ignore malformed frames
            }
          }
        }

        setHistory([
          ...nextHistory,
          { role: "assistant", content: assistantText || "(searched the data)" },
        ]);
      } catch {
        toast.error("Couldn't reach the analyst. Check your connection.");
        setEntries((prev) => prev.slice(0, -1));
      } finally {
        setPending(false);
        setToolStatus(null);
      }
    },
    [history, pending]
  );

  const voice = useVoiceInput((finalText) => {
    setInput(finalText);
    send(finalText);
  });

  useEffect(() => {
    if (voice.listening && voice.transcript) setInput(voice.transcript);
  }, [voice.listening, voice.transcript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries, toolStatus]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Esc closes, matching Claude.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const composer = (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="rounded-[1.75rem] border border-[#E5E2D9] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-shadow focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.10)]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={
            voice.listening ? "Listening…" : "Ask about creators, plates, or the marketplace…"
          }
          disabled={pending}
          className="max-h-40 min-h-[28px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-relaxed text-[#1F1E1D] placeholder:text-[#9B968A] focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {voice.supported ? (
            <button
              type="button"
              onClick={voice.toggle}
              disabled={pending}
              aria-label={voice.listening ? "Stop and send" : "Speak to Cleopatra"}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 ${
                voice.listening
                  ? "bg-[#C15F3C] text-white shadow-[0_4px_18px_rgba(193,95,60,0.5)]"
                  : "bg-[#C15F3C] text-white shadow-[0_3px_12px_rgba(193,95,60,0.35)] hover:bg-[#A94F30]"
              }`}
            >
              {voice.listening ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-[#C15F3C]/40" />
              ) : null}
              <Mic size={22} className="relative" />
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => send(input)}
            disabled={pending || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D2A26] text-white transition-all hover:bg-[#1F1E1D] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E0DDD3] disabled:text-[#B5B1A6]"
          >
            {pending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={17} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#9B968A]">
        {voice.supported
          ? "Tap the mic to ask out loud, or type — cards come from live data"
          : "Cards come from live marketplace data — KDER internal analyst"}
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F5F4EE] text-[#1F1E1D]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E2D9] px-4 py-3">
        <div className="flex items-center gap-2">
          <ClaudeMark size={16} />
          <div className="leading-none">
            <span className="text-[15px] font-semibold text-[#1F1E1D]">
              Cleopatra VII
            </span>
            <p className="mt-0.5 text-[11px] text-[#9B968A]">
              KDER data analyst
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6862] transition-colors hover:bg-[#EAE8DF]"
        >
          <X size={20} />
        </button>
      </div>

      {!started ? (
        /* Empty state — Claude-style centered greeting + composer */
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-8 flex flex-col items-center gap-4">
            <ClaudeMark size={30} />
            <h1 className="text-center text-[28px] font-semibold tracking-tight text-[#3D2C23]">
              I&apos;m Cleopatra VII. What can I find in your data?
            </h1>
          </div>

          {/* Voice is the primary way in: a big tap-to-talk mic. */}
          {voice.supported ? (
            <div className="mb-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={voice.toggle}
                disabled={pending}
                aria-label={voice.listening ? "Stop and send" : "Speak to Cleopatra"}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-50 ${
                  voice.listening
                    ? "bg-[#C15F3C] shadow-[0_8px_36px_rgba(193,95,60,0.55)]"
                    : "bg-[#C15F3C] shadow-[0_6px_28px_rgba(193,95,60,0.4)] hover:bg-[#A94F30]"
                }`}
              >
                {voice.listening ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#C15F3C]/40" />
                ) : null}
                <Mic size={40} className="relative" strokeWidth={2} />
              </button>
              <p className="text-[14px] font-medium text-[#6B6862]">
                {voice.listening ? "Listening… tap to send" : "Tap to ask out loud"}
              </p>
            </div>
          ) : null}

          {composer}
          <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2 px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-[#E5E2D9] bg-white px-3.5 py-2 text-[13px] text-[#3D3A34] transition-colors hover:bg-[#F0EEE6]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
              {entries.map((entry, i) => {
                if (entry.kind === "user") {
                  return (
                    <div key={i} className="mb-6 flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-[#F0EEE6] px-4 py-2.5 text-[15px] leading-relaxed text-[#1F1E1D]">
                        {entry.text}
                      </div>
                    </div>
                  );
                }
                if (entry.kind === "assistant") {
                  if (!entry.text) return null;
                  return (
                    <div key={i} className="mb-6 flex gap-3">
                      <ClaudeMark size={16} />
                      <div className="flex-1 whitespace-pre-wrap pt-1 text-[15px] leading-relaxed text-[#1F1E1D]">
                        {entry.text}
                      </div>
                    </div>
                  );
                }
                if (entry.kind === "plates") {
                  if (entry.plates.length === 0) return null;
                  return (
                    <div
                      key={i}
                      className="mb-6 grid grid-cols-1 gap-3 pl-9 sm:grid-cols-2"
                    >
                      {entry.plates.map((p) => (
                        <PlateResultCard key={p.id} plate={p} />
                      ))}
                    </div>
                  );
                }
                if (entry.creators.length === 0) return null;
                return (
                  <div key={i} className="mb-6 space-y-3 pl-9">
                    {entry.creators.map((c) => (
                      <CreatorResultCard key={c.id} creator={c} />
                    ))}
                  </div>
                );
              })}

              {toolStatus ? (
                <div className="mb-6 flex items-center gap-2 pl-9 text-[14px] text-[#8A8578]">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="animate-pulse">{toolStatus}…</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Composer pinned bottom */}
          <div className="border-t border-[#E5E2D9] bg-[#F5F4EE] py-4">
            {composer}
          </div>
        </>
      )}
    </div>
  );
}
