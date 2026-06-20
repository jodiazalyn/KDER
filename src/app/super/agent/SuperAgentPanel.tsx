"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Mic, ArrowUp, Loader2, Asterisk, ImagePlus } from "lucide-react";
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

// API content is a plain string, or a block array when images ride along.
type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ApiContent = string | Array<{ type: "text"; text: string } | ImageBlock>;

interface ApiMessage {
  role: "user" | "assistant";
  content: ApiContent;
}

// A pasted/dropped/picked image, held only until the turn is sent.
interface Attachment {
  id: string;
  dataUrl: string; // for the on-screen thumbnail
  mediaType: string;
  base64: string; // payload sent to the API (no data: prefix)
}

type Entry =
  | { kind: "user"; text: string; images?: string[] }
  | { kind: "assistant"; text: string }
  | { kind: "plates"; plates: PlateCard[] }
  | { kind: "creators"; creators: CreatorCard[] };

// Client-side guardrails mirror the API's; reject early with a clear toast.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 4;

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the current turn was started by voice, so we only auto-
  // reopen the mic (the hands-free loop) after a spoken question — never after
  // the cofounder typed. Set on voice submit, cleared on any manual input.
  const voiceModeRef = useRef(false);
  // Previous `pending`, to detect the true→false edge when a reply finishes.
  const prevPendingRef = useRef(false);
  // Mic gesture state: distinguishes a quick tap (toggle hands-free) from a
  // press-and-hold (walkie-talkie: listen while held, send on release).
  const pressStartRef = useRef<number | null>(null);
  const startedOnPressRef = useRef(false);
  const pointerHandledRef = useRef(false);

  const started = entries.length > 0;

  const send = useCallback(
    async (raw: string, imgs: Attachment[] = attachments) => {
      const trimmed = raw.trim();
      const hasImages = imgs.length > 0;
      if ((!trimmed && !hasImages) || pending) return;

      // What the cofounder sees / what we keep in history is the caption text;
      // a captionless screenshot gets a friendly stand-in label.
      const displayText =
        trimmed || (hasImages ? "(screenshot attached)" : "");

      // What we send the API this turn: blocks when images are attached, so
      // the model can actually see them; a plain string otherwise.
      const apiContent: ApiContent = hasImages
        ? [
            { type: "text", text: trimmed || "Analyze the attached image(s)." },
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
      // History we persist drops the image payload (text-only) — we don't
      // resend large base64 on every follow-up turn.
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
        const res = await fetch("/api/v1/admin/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
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
    [history, pending, attachments]
  );

  const voice = useVoiceInput((finalText) => {
    // This turn came from speaking — remember it so the mic reopens after the
    // reply, completing the hands-free loop.
    voiceModeRef.current = true;
    setInput(finalText);
    send(finalText);
  });

  useEffect(() => {
    if (voice.listening && voice.transcript) setInput(voice.transcript);
  }, [voice.listening, voice.transcript]);

  // Hands-free loop: when a voice-driven reply finishes (pending true→false),
  // reopen the mic after a short beat so the cofounder can just keep talking.
  // Guarded so it never fires after a typed turn or while the panel is closed.
  const { supported: voiceSupported, listening, start: startVoice } = voice;
  useEffect(() => {
    const was = prevPendingRef.current;
    prevPendingRef.current = pending;
    if (
      was &&
      !pending &&
      voiceModeRef.current &&
      open &&
      voiceSupported &&
      !listening
    ) {
      const t = setTimeout(() => {
        if (voiceModeRef.current && !listening) startVoice();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [pending, open, voiceSupported, listening, startVoice]);

  // Closing the panel ends the hands-free loop.
  useEffect(() => {
    if (!open) voiceModeRef.current = false;
  }, [open]);

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

  // The large mic is the primary way to talk to Cleopatra — shown both on
  // the empty state and pinned above the composer during a conversation, so a
  // follow-up is always one tap away (no hunting for a tiny inline icon).
  // One mic, two gestures. A quick TAP toggles the hands-free loop (tap to
  // start, tap again to send). A PRESS-AND-HOLD is push-to-talk: it listens
  // while held and sends on release. Pointer capture keeps the release event
  // on the button even if the finger drifts off.
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
    voice.toggle();
  };

  // Validate, read, and stage dropped/pasted/picked images. Reject the wrong
  // type or anything too big up front with a clear toast.
  const addFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (images.length === 0) return;

    const accepted: File[] = [];
    for (const f of images) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error(`Unsupported image type: ${f.type || "unknown"}.`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name || "Image"} is too large (max 5MB).`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    const read = await Promise.all(accepted.map(readImageFile));
    const valid = read.filter((a): a is Attachment => a != null);
    if (valid.length === 0) return;

    setAttachments((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`Up to ${MAX_IMAGES} images per question.`);
        return prev;
      }
      if (valid.length > room) {
        toast.error(`Only the first ${MAX_IMAGES} images were added.`);
      }
      return [...prev, ...valid.slice(0, room)];
    });
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

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
          aria-label={voice.listening ? "Stop and send" : "Speak to Cleopatra"}
          className={`relative flex items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-50 ${
            hero ? "h-24 w-24" : "h-16 w-16"
          } ${
            voice.listening
              ? "bg-[#C15F3C] shadow-[0_8px_36px_rgba(193,95,60,0.55)]"
              : "bg-[#C15F3C] shadow-[0_6px_28px_rgba(193,95,60,0.4)] hover:bg-[#A94F30]"
          }`}
        >
          {/* Pulse while actively listening; swap to the countdown ring once
              they go quiet so they can see (and cancel) the pending send. */}
          {voice.listening && !counting ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#C15F3C]/40" />
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
          className={`font-medium text-[#6B6862] ${hero ? "text-[14px]" : "text-[12px]"}`}
        >
          {counting
            ? "Sending… keep talking to cancel"
            : voice.listening
              ? "Listening… tap to send"
              : hero
                ? "Tap to ask out loud"
                : "Tap to ask a follow-up"}
        </p>
        {/* Teach both gestures, but only while idle so it doesn't clutter the
            live listening/sending states. */}
        {idle ? (
          <p
            className={`text-[#A8A398] ${hero ? "text-[12px]" : "text-[11px]"}`}
          >
            Tap for hands-free · hold to push-to-talk
          </p>
        ) : null}
      </div>
    );
  };

  const canSend = !pending && (input.trim().length > 0 || attachments.length > 0);

  const composer = (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-[1.75rem] border bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-shadow focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.10)] ${
          dragActive
            ? "border-[#C15F3C] ring-2 ring-[#C15F3C]/30"
            : "border-[#E5E2D9]"
        }`}
      >
        {/* Hidden picker driven by the attach button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Thumbnails of staged images, removable before send. */}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#E5E2D9]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.dataUrl}
                  alt="Attachment preview"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label="Remove image"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            // Real typing means they want to type — leave the hands-free loop.
            voiceModeRef.current = false;
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              voiceModeRef.current = false;
              send(input);
            }
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const it of items) {
              if (it.kind === "file" && it.type.startsWith("image/")) {
                const f = it.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length > 0) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          rows={1}
          placeholder={
            voice.listening
              ? "Listening…"
              : voice.supported
                ? "Or type a question — paste or drop an image…"
                : "Ask about creators, plates, or paste an image…"
          }
          disabled={pending}
          className="max-h-40 min-h-[28px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-relaxed text-[#1F1E1D] placeholder:text-[#9B968A] focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || attachments.length >= MAX_IMAGES}
            aria-label="Attach image"
            title="Attach an image (or paste / drag one in)"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6862] transition-colors hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ImagePlus size={19} />
          </button>
          <button
            type="button"
            onClick={() => {
              voiceModeRef.current = false;
              send(input);
            }}
            disabled={!canSend}
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
          {voice.supported ? <div className="mb-8">{bigMic("hero")}</div> : null}

          {composer}
          <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2 px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  voiceModeRef.current = false;
                  send(s);
                }}
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
                    <div
                      key={i}
                      className="mb-6 flex flex-col items-end gap-1.5"
                    >
                      {entry.images && entry.images.length > 0 ? (
                        <div className="flex max-w-[80%] flex-wrap justify-end gap-1.5">
                          {entry.images.map((src, j) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={j}
                              src={src}
                              alt="Attached image"
                              className="h-28 w-28 rounded-xl border border-[#E5E2D9] object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
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

          {/* Composer pinned bottom — big mic stays centered above it so a
              follow-up question is always one tap away. */}
          <div className="border-t border-[#E5E2D9] bg-[#F5F4EE] py-4">
            {voice.supported ? (
              <div className="mb-3 flex justify-center">{bigMic("footer")}</div>
            ) : null}
            {composer}
          </div>
        </>
      )}
    </div>
  );
}
