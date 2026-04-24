"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Reusable AI draft trigger.
 *
 * Renders a "Draft with AI" / "Regenerate" button plus an optional hint
 * input. Streams Claude's response word-by-word into the parent via
 * `onTextUpdate` so the creator sees prose appear in real time. When the
 * stream starts, we clear any prior AI text; creator-typed starter text is
 * passed through so Claude continues it rather than overwriting.
 *
 * Parent component owns the textarea value — this component doesn't. It
 * just calls `onTextUpdate(fullStreamedText)` on each delta.
 */

export type AiDraftKind = "plate" | "bio" | "caption";

export interface AiDraftContext {
  creatorDisplayName?: string;
  creatorHandle?: string;
  plateName?: string;
  plateTags?: string[];
}

interface AiDraftButtonProps {
  kind: AiDraftKind;
  /** Current textarea value (used as starter — Claude continues creator prose). */
  currentText: string;
  /** Image URLs (required for kind="plate", optional elsewhere). */
  imageUrls?: string[];
  /** Factual anchors passed to the prompt builder. */
  context?: AiDraftContext;
  /** Called on every stream delta with the cumulative AI text so far. */
  onTextUpdate: (text: string) => void;
  /** Optional trigger — when this key changes, the draft auto-fires once. */
  autoTriggerKey?: string | number | null;
  /** Hide the hint input (useful when space is tight). */
  hideHint?: boolean;
  className?: string;
}

export function AiDraftButton({
  kind,
  currentText,
  imageUrls,
  context,
  onTextUpdate,
  autoTriggerKey,
  hideHint,
  className,
}: AiDraftButtonProps) {
  const [streaming, setStreaming] = useState(false);
  const [hint, setHint] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  // Track the last auto-trigger key we fired against — so changes to inputs
  // other than the key don't re-fire the draft.
  const lastAutoKeyRef = useRef<string | number | null | undefined>(
    autoTriggerKey
  );
  // Keep a ref of the "starter" text at the moment the stream opens. We
  // read currentText inside the async function; using a ref keeps it
  // stable if the parent re-renders mid-stream.
  const abortRef = useRef<AbortController | null>(null);

  const runDraft = useCallback(
    async (opts?: { hint?: string }) => {
      if (streaming) return;

      // Plate drafts need at least one image to anchor detail.
      if (kind === "plate" && (!imageUrls || imageUrls.length === 0)) {
        toast.error("Add a photo first and Claude will draft a description.");
        return;
      }

      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      // Capture starter at stream start — what's in the textarea now.
      const starter = currentText ?? "";

      try {
        const res = await fetch("/api/v1/ai/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            imageUrls: imageUrls ?? [],
            starter,
            hint: opts?.hint ?? hint ?? undefined,
            context,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          // Non-stream error (401/429/503/etc). Surface the server's message.
          let msg = "AI drafting is temporarily unavailable.";
          try {
            const json = (await res.json()) as { error?: string };
            if (json?.error) msg = json.error;
          } catch {
            /* non-JSON body — keep default */
          }
          toast.error(msg);
          return;
        }

        if (!res.body) {
          toast.error("AI drafting returned no stream.");
          return;
        }

        // Decode SSE: lines like `data: {"type":"delta","text":"..."}`.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // We REPLACE textarea contents with fresh AI output — the starter is
        // already in the prompt on the server, so the model continues it and
        // returns the full draft. Writing to a "starter + aiText" on the
        // client would double up. Parent sees cumulative streamed text.
        let aiText = "";

        onTextUpdate(aiText);

        // Stream loop
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          const frames = buffer.split("\n\n");
          // Keep the last (possibly incomplete) frame in the buffer.
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            // Each frame may have multiple `data:` lines; take the first.
            const line = frame
              .split("\n")
              .find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice("data:".length).trim();
            if (!payload) continue;
            try {
              const msg = JSON.parse(payload) as
                | { type: "delta"; text: string }
                | { type: "done" }
                | { type: "error"; message?: string };

              if (msg.type === "delta") {
                aiText += msg.text;
                onTextUpdate(aiText);
              } else if (msg.type === "error") {
                toast.error(
                  msg.message ||
                    "The AI draft was interrupted. Keep editing if you like."
                );
              }
              // "done" — handled by loop end
            } catch {
              // Bad frame — skip and keep streaming.
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          // User navigated away or component unmounted — silent.
          return;
        }
        console.error("AiDraftButton error:", err);
        toast.error("AI drafting failed. Please try again.");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, kind, imageUrls, currentText, hint, context, onTextUpdate]
  );

  // Auto-trigger effect — fires once per change of `autoTriggerKey`.
  useEffect(() => {
    if (autoTriggerKey == null) return;
    if (lastAutoKeyRef.current === autoTriggerKey) return;
    lastAutoKeyRef.current = autoTriggerKey;
    // Defer out of the effect body to satisfy React 19's
    // set-state-in-effect rule (runDraft calls setState internally).
    const id = setTimeout(() => {
      runDraft();
    }, 0);
    return () => clearTimeout(id);
    // runDraft intentionally omitted — we only want to fire on key change,
    // not on every closure refresh. runDraft always reads the latest props
    // via its own captured values at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerKey]);

  // Clean up any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const label = currentText.trim().length > 0 ? "Regenerate" : "Draft with AI";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => runDraft()}
          disabled={streaming}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98]",
            streaming
              ? "border-white/10 bg-white/5 text-white/40 cursor-wait"
              : "border-green-400/30 bg-green-900/25 text-green-200 hover:bg-green-900/40"
          )}
        >
          {streaming ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Drafting…
            </>
          ) : currentText.trim().length > 0 ? (
            <>
              <RefreshCw size={12} />
              {label}
            </>
          ) : (
            <>
              <Sparkles size={12} />
              {label}
            </>
          )}
        </button>

        {!hideHint && (
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            {hintOpen ? "Hide hint" : "Tweak tone"}
          </button>
        )}
      </div>

      {!hideHint && hintOpen && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value.slice(0, 200))}
            placeholder="e.g., make it shorter, emphasize smoky, keep it family-friendly"
            className="h-9 flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-xs text-white placeholder:text-white/35 focus:border-green-400/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => runDraft({ hint })}
            disabled={streaming}
            className="inline-flex items-center gap-1 rounded-xl border border-green-400/30 bg-green-900/25 px-3 py-1.5 text-xs font-medium text-green-200 transition-all hover:bg-green-900/40 disabled:opacity-50 disabled:cursor-wait"
          >
            <Sparkles size={12} />
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
