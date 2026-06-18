"use client";

import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
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
   * Fires when the user dismisses (Got it / X / backdrop tap). Lets
   * the parent chain coachmarks explicitly when it wants ordered
   * dependencies. (The global queue handles ad-hoc multiplicity
   * automatically; this callback is still useful for derived state.)
   */
  onDismiss?: () => void;
}

// ── Global FIFO queue ───────────────────────────────────────────
// Pages frequently mount several <Coachmark>s at once (e.g. the
// new-plate form has four). The earlier implementation rendered all
// of them simultaneously, which stacked Got-It buttons on top of
// each other and made dismissal feel broken — tapping one popup
// revealed another underneath in the same screen region, so users
// reported "the tooltip isn't disappearing." This queue ensures
// exactly one coachmark is visible at any moment, in mount order.
const coachmarkQueue: string[] = [];
const listeners = new Set<() => void>();
function notifyQueue() {
  listeners.forEach((l) => l());
}
function enqueue(uid: string) {
  if (!coachmarkQueue.includes(uid)) {
    coachmarkQueue.push(uid);
    notifyQueue();
  }
}
function dequeue(uid: string) {
  const i = coachmarkQueue.indexOf(uid);
  if (i !== -1) {
    coachmarkQueue.splice(i, 1);
    notifyQueue();
  }
}

/**
 * First-visit-only educational coachmark. Highlights a single UI
 * element with a dim spotlight + tooltip-style bubble explaining
 * what it does. Tap "Got it", the X icon, or anywhere off the
 * bubble to dismiss forever (localStorage-keyed by id).
 *
 * Pair with `<InfoTip>` for the persistent re-readable hint after
 * dismissal — same copy, lower-stakes affordance the user can return
 * to anytime via a (?) icon.
 *
 * Pages can mount several Coachmarks at once; the global FIFO queue
 * ensures they render one at a time in mount order. (For an
 * explicit dependency between two coachmarks, the `onDismiss`
 * callback still works — it fires the moment THIS coachmark exits,
 * which is also the moment the next-in-queue takes over.)
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
  const uid = useId();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    isCoachmarkDismissed(id)
  );
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reduceMotion = useReducedMotion();

  // Subscribe to the global queue head so this instance flips to
  // active exactly when it's our turn (i.e. all earlier-mounted
  // coachmarks have dismissed).
  const isActive = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => coachmarkQueue[0] === uid,
    () => false
  );

  // Register / unregister with the queue. Dismissed coachmarks
  // never enqueue. Cleanup removes us if we unmount before
  // dismissing (e.g. parent route change).
  useEffect(() => {
    if (dismissed) return;
    enqueue(uid);
    return () => {
      dequeue(uid);
    };
  }, [uid, dismissed]);

  // Measure the target element. Only attempts to measure once we're
  // the active coachmark — earlier-queue items haven't reached us
  // yet, so the bubble shouldn't have laid out either. The setState
  // calls here all live inside callbacks (rAF / setTimeout / event
  // handlers), never synchronously in the effect body — satisfies
  // the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (dismissed || !isActive) return;
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
  }, [dismissed, isActive, targetRef, showDelayMs]);

  if (
    dismissed ||
    !isActive ||
    !rect ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const handleDismiss = () => {
    // Dequeue + persist + local-flip + parent notify, in that order
    // so the next coachmark renders immediately on the same tick.
    dequeue(uid);
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
    // `pointer-events-auto` is load-bearing: the portal mounts to
    // document.body, but when a Coachmark fires inside a Radix
    // Dialog/Sheet (e.g. the Mia chat sheet) Radix sets
    // pointer-events:none on body to keep clicks inside its
    // content. Without the explicit override, the coachmark
    // backdrop + bubble inherit pointer-events:none → the X and
    // "Got it" buttons render but never fire onClick. Creators
    // reported this as "the tooltip won't go away" on the Mia
    // welcome popup. Forcing auto here re-enables clicks on the
    // whole coachmark layer regardless of ancestor styles.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tip"
      className={`pointer-events-auto fixed inset-0 z-[80] ${reduceMotion ? "" : "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"}`}
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

      {/* Bubble — glass-card-elevated for the iOS-y depth + glass-shine
          for the specular highlight. The green ring + border keep
          KDER's brand tint. Three dismiss affordances:
            1. X icon top-right (most discoverable)
            2. Got it primary CTA bottom-right
            3. Tap anywhere off the bubble (backdrop)
          Any one of them fires handleDismiss. */}
      <div
        className={`glass-card-elevated glass-shine absolute max-w-[calc(100vw-2rem)] border border-green-400/40 p-4 pr-10 ring-1 ring-green-400/15 ${reduceMotion ? "" : "motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200"}`}
        style={{
          top: bubbleTop,
          left: clampedLeft,
          width: BUBBLE_W,
          transform: bubbleTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close — top-right corner of the bubble. Some users skip
            primary CTAs and look for an X; this gives them an out. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss tip"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-90 transition-all"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
        <p className="text-sm leading-relaxed text-foreground">{copy}</p>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-9 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(34,197,94,0.35)] active:scale-95 transition-transform"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
