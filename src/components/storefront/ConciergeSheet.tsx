"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Mic,
  ArrowUp,
  Loader2,
  ImagePlus,
  Volume2,
  VolumeX,
  Sparkles,
  Plus,
} from "lucide-react";
import { useVoiceInput } from "@/lib/voice/useVoiceInput";
import type { ConciergePlateCard } from "@/lib/concierge/concierge-tools";

/* ────────────────────────────────────────────────────────────────
 * Drive Thru — the public storefront food & nutrition concierge.
 *
 * A bottom-sheet voice/photo concierge any visitor can open from a
 * storefront. It streams from /api/v1/ai/concierge, surfaces real,
 * orderable plate cards from across the whole marketplace, and bridges
 * a pick straight into that creator's existing order flow via
 * `onPickPlate`. Everything is theme-token styled so it reads cleanly
 * in light and dark mode.
 * ──────────────────────────────────────────────────────────────── */

type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ApiContent = string | Array<{ type: "text"; text: string } | ImageBlock>;
interface ApiMessage {
  role: "user" | "assistant";
  content: ApiContent;
}

interface Attachment {
  id: string;
  dataUrl: string;
  mediaType: string;
  base64: string;
}

type Entry =
  | { kind: "user"; text: string; images?: string[] }
  | { kind: "assistant"; text: string }
  | { kind: "plates"; plates: ConciergePlateCard[] };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;

const SUGGESTIONS = [
  "High-protein lunch under $15",
  "Something vegan and filling",
  "Keto-friendly dinner, delivered",
  "What's popular right now?",
];

function readImageFile(file: File): Promise<Attachment | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : "";
      if (!base64) return resolve(null);
      resolve({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        dataUrl: result,
        mediaType: file.type,
        base64,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Strip emoji/markdown so the spoken reply sounds natural. */
function forSpeech(text: string): string {
  return text
    .replace(/[*_`#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export function ConciergeSheet({
  open,
  onClose,
  onPickPlate,
}: {
  open: boolean;
  onClose: () => void;
  /** Called when the visitor taps "Order" on a surfaced plate. The parent
   *  bridges it into the right creator's order flow. */
  onPickPlate: (plate: ConciergePlateCard) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [muted, setMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Only auto-reopen the mic (hands-free) after a SPOKEN turn, never a typed one.
  const voiceModeRef = useRef(false);
  const prevPendingRef = useRef(false);
  const lastAssistantRef = useRef("");
  // Mic gesture state — distinguishes a quick TAP (hands-free toggle) from a
  // PRESS-AND-HOLD (push-to-talk: listen while held, send on release). Mirrors
  // the founders' Cleopatra VII voice button exactly.
  const pressStartRef = useRef<number | null>(null);
  const startedOnPressRef = useRef(false);
  const pointerHandledRef = useRef(false);

  const started = entries.length > 0;

  const speak = useCallback(
    (text: string) => {
      if (muted || typeof window === "undefined" || !window.speechSynthesis)
        return;
      const clean = forSpeech(text);
      if (!clean) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.02;
        u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      } catch {
        // TTS is a nicety — never let it break the flow.
      }
    },
    [muted]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const send = useCallback(
    async (raw: string, imgs: Attachment[] = attachments) => {
      const trimmed = raw.trim();
      const hasImages = imgs.length > 0;
      if ((!trimmed && !hasImages) || pending) return;
      stopSpeaking();

      const displayText =
        trimmed || (hasImages ? "📷 (photo attached)" : "");

      const apiContent: ApiContent = hasImages
        ? [
            {
              type: "text",
              text:
                trimmed ||
                "Here's a photo of a dish — tell me about its nutrition and find me something like it on KDER.",
            },
            ...imgs.map(
              (a): ImageBlock => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: a.mediaType,
                  data: a.base64,
                },
              })
            ),
          ]
        : trimmed;

      const apiMessages: ApiMessage[] = [
        ...history,
        { role: "user", content: apiContent },
      ];
      const nextHistory: ApiMessage[] = [
        ...history,
        { role: "user", content: displayText },
      ];

      setEntries((prev) => [
        ...prev,
        {
          kind: "user",
          text: displayText,
          images: hasImages ? imgs.map((a) => a.dataUrl) : undefined,
        },
        { kind: "assistant", text: "" },
      ]);
      setInput("");
      setAttachments([]);
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
        const res = await fetch("/api/v1/ai/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body?.error || "Drive Thru hit a snag. Try again.");
          setEntries((prev) => prev.slice(0, -1));
          return;
        }
        if (!res.body) {
          toast.error("No response. Try again.");
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
                  if (typeof payload.text === "string")
                    appendDelta(payload.text);
                  break;
                case "tool_use_start":
                  setToolStatus("Finding plates");
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
                  }
                  break;
                case "done":
                  setToolStatus(null);
                  break;
                case "error":
                  toast.error(payload.message || "Drive Thru got interrupted.");
                  setToolStatus(null);
                  break;
              }
            } catch {
              // ignore malformed frames
            }
          }
        }

        lastAssistantRef.current = assistantText;
        setHistory([
          ...nextHistory,
          {
            role: "assistant",
            content: assistantText || "(found some plates for you)",
          },
        ]);
      } catch {
        toast.error("Couldn't reach Drive Thru. Check your connection.");
        setEntries((prev) => prev.slice(0, -1));
      } finally {
        setPending(false);
        setToolStatus(null);
      }
    },
    [attachments, history, pending, stopSpeaking]
  );

  // ── Voice ─────────────────────────────────────────────────────
  const voice = useVoiceInput((finalText) => {
    voiceModeRef.current = true;
    void send(finalText);
  });

  // Mirror the live transcript into the input box while dictating.
  useEffect(() => {
    if (voice.listening && voice.transcript) setInput(voice.transcript);
  }, [voice.listening, voice.transcript]);

  // When a reply finishes: speak it, then (if the turn was spoken) reopen the
  // mic so it's a hands-free back-and-forth.
  useEffect(() => {
    const justFinished = prevPendingRef.current && !pending;
    prevPendingRef.current = pending;
    if (!justFinished) return;
    const reply = lastAssistantRef.current;
    if (reply) speak(reply);
    if (voiceModeRef.current && voice.supported && !muted) {
      const t = setTimeout(() => voice.start(), 700);
      return () => clearTimeout(t);
    }
  }, [pending, speak, muted, voice]);

  // Auto-scroll to newest content.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, toolStatus, open]);

  // Stop voice + speech whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      voice.stop();
      stopSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const picked: Attachment[] = [];
    for (const f of list) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error("That file type isn't supported.");
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error("Image is too large (5MB max).");
        continue;
      }
      const att = await readImageFile(f);
      if (att) picked.push(att);
    }
    if (picked.length === 0) return;
    setAttachments((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
  }, []);

  const handleSubmit = useCallback(() => {
    voiceModeRef.current = false;
    void send(input);
  }, [input, send]);

  if (!open) return null;

  // The large mic is the primary way to talk to Drive Thru — shown big on the
  // empty state and pinned above the composer mid-conversation, so a follow-up
  // is always one tap away. One mic, two gestures: a quick TAP toggles the
  // hands-free loop (tap to start, tap again to send); a PRESS-AND-HOLD is
  // push-to-talk (listen while held, send on release). Pointer capture keeps
  // the release on the button even if the finger drifts off.
  const HOLD_MS = 350;
  const onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    pointerHandledRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw on some engines — non-fatal.
    }
    pressStartRef.current = Date.now();
    if (!voice.listening) {
      startedOnPressRef.current = true;
      voiceModeRef.current = true;
      voice.start();
    } else {
      startedOnPressRef.current = false;
    }
  };
  const endMicPress = () => {
    if (pressStartRef.current == null) return;
    const held = Date.now() - pressStartRef.current;
    pressStartRef.current = null;
    if (held >= HOLD_MS) {
      voice.stop(); // push-to-talk release → finalize + send
    } else if (!startedOnPressRef.current) {
      voice.stop(); // quick tap while already listening → send
    }
    // else: a quick tap that just opened the mic → stay in hands-free mode.
  };
  const onMicClick = () => {
    // Keyboard (Enter/Space) fires click with no pointer events; pointer
    // gestures are handled above, so swallow their trailing synthetic click.
    if (pointerHandledRef.current) {
      pointerHandledRef.current = false;
      return;
    }
    voiceModeRef.current = true;
    voice.toggle();
  };

  const bigMic = (variant: "hero" | "footer") => {
    if (!voice.supported) return null;
    const hero = variant === "hero";
    const counting = voice.countdownProgress > 0;
    const idle = !voice.listening && !counting;
    // SVG ring circumference for r=46 in a 100×100 viewBox.
    const RING = 2 * Math.PI * 46;
    return (
      <div className={`flex flex-col items-center ${hero ? "gap-3" : "gap-1.5"}`}>
        <button
          type="button"
          onPointerDown={onMicPointerDown}
          onPointerUp={endMicPress}
          onPointerCancel={endMicPress}
          onClick={onMicClick}
          disabled={pending}
          aria-label={voice.listening ? "Stop and send" : "Speak to Drive Thru"}
          className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] text-white transition-all active:scale-95 disabled:opacity-50 ${
            hero ? "h-24 w-24" : "h-16 w-16"
          } ${
            voice.listening
              ? "shadow-[0_8px_36px_rgba(34,197,94,0.55)]"
              : "shadow-[0_6px_28px_rgba(34,197,94,0.4)]"
          }`}
        >
          {/* Pulse while actively listening; swap to the countdown ring once
              they go quiet so they can see (and cancel) the pending send. */}
          {voice.listening && !counting ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#22C55E]/40" />
          ) : null}
          {counting ? (
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - voice.countdownProgress)}
              />
            </svg>
          ) : null}
          <Mic size={hero ? 40 : 28} className="relative" strokeWidth={2} />
        </button>
        <p
          className={`font-medium text-foreground ${hero ? "text-sm" : "text-xs"}`}
        >
          {counting
            ? "Sending… keep talking to cancel"
            : voice.listening
              ? "Listening… tap to send"
              : hero
                ? "Tap to ask out loud"
                : "Tap to ask a follow-up"}
        </p>
        {idle ? (
          <p className={`text-muted-foreground ${hero ? "text-xs" : "text-[11px]"}`}>
            Tap for hands-free · hold to push-to-talk
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Scrim */}
      <button
        aria-label="Close Drive Thru"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Sheet */}
      <div className="relative flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:h-[85vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] text-white">
            <Sparkles size={18} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              Drive Thru
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Your KDER food &amp; nutrition concierge
            </p>
          </div>
          <button
            onClick={() => {
              setMuted((m) => {
                if (!m) stopSpeaking();
                return !m;
              });
            }}
            aria-label={muted ? "Unmute voice replies" : "Mute voice replies"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {!started ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h3 className="mb-1 text-lg font-extrabold text-foreground">
                Tell me what you&apos;re craving
              </h3>
              <p className="mb-6 max-w-xs text-sm text-muted-foreground">
                I&apos;ll search every kitchen on KDER — by diet, budget, or
                vibe. Talk to me, type, or snap a photo of a dish.
              </p>

              {/* Big voice button — the primary way in, same as Cleopatra. */}
              {voice.supported ? bigMic("hero") : null}

              <div className="mt-7 flex w-full flex-col gap-2">
                {voice.supported && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    or tap an idea
                  </p>
                )}
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      voiceModeRef.current = false;
                      void send(s);
                    }}
                    className="rounded-xl border border-border bg-foreground/[0.02] px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-foreground/[0.06]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry, i) => {
                if (entry.kind === "user") {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                        {entry.images && entry.images.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {entry.images.map((src, j) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={j}
                                src={src}
                                alt="attachment"
                                className="h-20 w-20 rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {entry.text && <p>{entry.text}</p>}
                      </div>
                    </div>
                  );
                }
                if (entry.kind === "assistant") {
                  return (
                    <div key={i} className="flex gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] text-white">
                        <Sparkles size={13} strokeWidth={2.4} />
                      </div>
                      <p className="whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-foreground">
                        {entry.text}
                        {pending && i === entries.length - 1 && !entry.text && (
                          <span className="text-muted-foreground">
                            thinking…
                          </span>
                        )}
                      </p>
                    </div>
                  );
                }
                // plates
                return (
                  <div key={i} className="flex flex-col gap-2.5">
                    {entry.plates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No matches — try loosening that a bit.
                      </p>
                    ) : (
                      entry.plates.map((p) => (
                        <ConciergePlateRow
                          key={p.id}
                          plate={p}
                          onOrder={() => onPickPlate(p)}
                        />
                      ))
                    )}
                  </div>
                );
              })}

              {toolStatus && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" />
                  {toolStatus}…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Big follow-up mic — pinned above the composer mid-conversation so a
            spoken follow-up is always one tap away (no hunting for a tiny
            inline icon), matching Cleopatra's footer mic. */}
        {started && voice.supported && (
          <div className="flex justify-center border-t border-border pt-3">
            {bigMic("footer")}
          </div>
        )}

        {/* Composer */}
        <div
          className={`px-3 py-3 ${
            started && voice.supported ? "" : "border-t border-border"
          }`}
        >
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <div key={a.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.dataUrl}
                    alt="attachment"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <button
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((x) => x.id !== a.id)
                      )
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove image"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-border bg-foreground/[0.02] px-2.5 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add a food photo"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <ImagePlus size={18} />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                voice.listening ? "Listening…" : "Ask Drive Thru anything…"
              }
              className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />

            <button
              onClick={handleSubmit}
              disabled={pending || (!input.trim() && attachments.length === 0)}
              aria-label="Send"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
            >
              {pending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-center text-[10px] text-muted-foreground">
            Drive Thru searches live KDER kitchens. Nutrition info is general,
            not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConciergePlateRow({
  plate,
  onOrder,
}: {
  plate: ConciergePlateCard;
  onOrder: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-foreground/[0.02] p-2.5">
      {plate.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plate.photo}
          alt={plate.name}
          className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground">
          <Sparkles size={20} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">
            {plate.name}
          </p>
          <p className="flex-shrink-0 text-sm font-bold text-foreground">
            ${plate.priceDollars.toFixed(2)}
          </p>
        </div>
        {plate.creator.handle && (
          <p className="truncate text-xs text-primary">
            @{plate.creator.handle}
          </p>
        )}
        {plate.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {plate.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          {plate.allergens.length > 0 ? (
            <p className="truncate text-[10px] text-muted-foreground">
              Contains: {plate.allergens.slice(0, 3).join(", ")}
            </p>
          ) : (
            <span />
          )}
          <button
            onClick={onOrder}
            className="flex flex-shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
          >
            <Plus size={13} strokeWidth={2.6} />
            Order
          </button>
        </div>
      </div>
    </div>
  );
}
