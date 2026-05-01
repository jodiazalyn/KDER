"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import {
  dismissCoachmark,
  isCoachmarkDismissed,
  type CoachmarkId,
} from "@/lib/coachmarks";

interface CoachmarkProps {
  /** Stable identifier for persistence. Must exist in COACHMARK_COPY. */
  id: CoachmarkId;
  /** The explanatory copy. Usually pulled from COACHMARK_COPY[id]. */
  copy: React.ReactNode;
  /**
   * Ref to the DOM element being explained. Used to position the
   * bubble below (or above, when there's no room) and to draw a
   * highlight ring around it.
   */
  targetRef: React.RefObject<HTMLElement | null>;
  /**
   * Optional delay before showing the coachmark on first visit.
   * Helps when the target hasn't laid out yet (e.g. lazy data load).
   * Default 0ms (show immediately on mount).
   */
  showDelayMs?: number;
  /**
   * Fires when the user dismisses (Got it / backdrop tap). Lets the
   * parent chain coachmarks — show one at a time, and only render
   * the next after the previous is dismissed.
   */
  onDismiss?: () => void;
}

/**
 * First-visit-only educational coachmark. Highlights a single UI
 * element with a dim spotlight + tooltip-style bubble explaining
 * what it does. Tap "Got it" or anywhere off the bubble to dismiss
 * forever (localStorage-keyed by id).
 *
 * Pair with `<InfoTip>` for the persistent re-readable hint after
 * dismissal — same copy, lower-stakes affordance the user can return
 * to anytime via a (?) icon.
 *
 * Honors `prefers-reduced-motion` (skip fade animations).
 */
export function Coachmark({
  id,
  copy,
  targetRef,
  showDelayMs = 0,
  onDismiss,
}: CoachmarkProps) {
  const [dismissed, setDismissed] = useState<boolean>(() =>
    isCoachmarkDismissed(id)
  );
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reduceMotion = useReducedMotion();

  // Measure the target element. Triggers `rect` becoming non-null,
  // which gates the portal render. Doubles as the "wait for client
  // mount" gate (effects only run on the client). The setState calls
  // here all live inside callbacks (rAF / setTimeout / event handlers),
  // never synchronously in the effect body — that satisfies the
  // react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (dismissed) return;
    const el = targetRef.current;
    if (!el) return;

    const update = () => {
      setRect(el.getBoundingClientRect());
    };

    if (showDelayMs > 0) {
      const timer = setTimeout(() => {
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
      }, showDelayMs);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    }

    // Measure on next frame so the target has finished layout.
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [dismissed, targetRef, showDelayMs]);

  if (dismissed || !rect || typeof document === "undefined") {
    return null;
  }

  const handleDismiss = () => {
    dismissCoachmark(id);
    setDismissed(true);
    onDismiss?.();
  };

  // Decide whether the bubble fits below the target. If not, flip above.
  const viewportH = window.innerHeight;
  const BUBBLE_ESTIMATED_H = 180; // copy + button; conservative
  const showBelow = rect.bottom + BUBBLE_ESTIMATED_H + 24 < viewportH;
  const bubbleTop = showBelow ? rect.bottom + 14 : rect.top - 14;
  const bubbleTransform = showBelow ? undefined : "translateY(-100%)";

  // Center bubble horizontally on the target, then clamp into the viewport.
  const BUBBLE_W = 300;
  const desiredLeft = rect.left + rect.width / 2 - BUBBLE_W / 2;
  const clampedLeft = Math.max(
    16,
    Math.min(desiredLeft, window.innerWidth - BUBBLE_W - 16)
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tip"
      className={`fixed inset-0 z-[80] ${reduceMotion ? "" : "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"}`}
      onClick={handleDismiss}
    >
      {/* Spotlight ring: a thin border around the target with a huge
          box-shadow that effectively dims everything outside the rect.
          One element does both jobs (highlight + backdrop dim). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-xl ring-2 ring-green-400/70 transition-shadow"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
        }}
      />

      {/* Bubble */}
      <div
        className={`absolute w-[${BUBBLE_W}px] max-w-[calc(100vw-2rem)] rounded-2xl border border-green-400/40 bg-[#0A0A0A] p-4 shadow-2xl ring-1 ring-green-400/15 ${reduceMotion ? "" : "motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200"}`}
        style={{
          top: bubbleTop,
          left: clampedLeft,
          width: BUBBLE_W,
          transform: bubbleTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-white/90">{copy}</p>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-9 items-center justify-center rounded-full bg-[#1B5E20] px-5 text-xs font-bold text-white shadow-[0_0_14px_rgba(27,94,32,0.4)] active:scale-95 transition-transform"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
