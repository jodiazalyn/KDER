"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useReducedMotion } from "framer-motion";

interface PullToRefreshProps {
  /**
   * Fires when the user pulls past the threshold and releases. Can be
   * sync or async — the spinner stays visible until the returned
   * promise resolves so the user has clear feedback that "yes, your
   * pull triggered a refresh."
   */
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
  /**
   * How far (px) the user must drag the wrapper before a release fires
   * the refresh. Default 80 — matches iOS / native app norms.
   */
  threshold?: number;
}

/**
 * Native-feeling pull-to-refresh wrapper.
 *
 * Usage: wrap a page's main scroll container. When the user is
 * scrolled to the top of the viewport AND drags downward past the
 * threshold, releasing fires `onRefresh`. While the user is pulling,
 * a spinner indicator translates into view above the content with a
 * rubber-band feel; release-with-fire transitions to a spinning
 * state until the onRefresh promise resolves.
 *
 * Why on `window.scrollY` and not the wrapper's own scroll: KDER's
 * pages scroll the document body, not an inner overflow container.
 * Watching `window.scrollY` matches what users actually see and
 * means we don't have to refactor every page to wrap content in an
 * overflow:auto div.
 *
 * Honors `prefers-reduced-motion` by suppressing the visual spinner
 * + content translation. The drag-to-fire logic still works (you'll
 * get a refresh), it's just silent. A small refresh icon ALSO
 * renders top-right at all times for reduced-motion users so they
 * have a tap-to-refresh affordance independent of the gesture.
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const reduceMotion = useReducedMotion();

  // Distance the user has dragged so far (rendered as content
  // translateY). `pullDistance` drives both the spinner opacity/
  // rotation and the body translate.
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs mirror the state so the touch handlers (bound once via the
  // empty-deps effect) can read fresh values without a re-bind churn.
  // Setting state through the helpers below keeps both in sync.
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  const setPull = (v: number) => {
    pullDistanceRef.current = v;
    setPullDistance(v);
  };
  const setRefreshingBoth = (v: boolean) => {
    refreshingRef.current = v;
    setRefreshing(v);
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      // Only start tracking if the document is scrolled to the very top.
      // Otherwise the user is mid-scroll and we should leave them alone.
      if (window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      if (refreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const delta = currentY - startYRef.current;

      // Only pulling DOWN from top of page counts. If user scrolled
      // away from top mid-gesture, abort.
      if (delta > 0 && window.scrollY === 0) {
        // Rubber-band damping: distance grows but each px of drag
        // contributes less the further we go. Capped at 1.5× threshold.
        const damped = Math.min(delta * 0.5, threshold * 1.5);
        setPull(damped);
      } else {
        setPull(0);
      }
    };

    const handleTouchEnd = async () => {
      const dragWasActive = startYRef.current !== null;
      startYRef.current = null;
      if (!dragWasActive) return;

      const finalDistance = pullDistanceRef.current;

      if (finalDistance >= threshold && !refreshingRef.current) {
        setRefreshingBoth(true);
        setPull(threshold); // Snap to threshold while spinner spins.
        try {
          await onRefresh();
        } finally {
          setRefreshingBoth(false);
          setPull(0);
        }
      } else {
        // Below threshold — snap back to 0 with the CSS transition
        // applied via inline style further down.
        setPull(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
    // Empty deps: refs keep handlers fresh, no need to re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  // Manual refresh affordance — small button top-right of viewport.
  // Always rendered for reduced-motion users (their gesture has no
  // visual feedback so an explicit tap target is essential). Also
  // useful for everyone as an Android fallback where touch event
  // capture can be inconsistent.
  const handleManualRefresh = async () => {
    if (refreshingRef.current) return;
    setRefreshingBoth(true);
    try {
      await onRefresh();
    } finally {
      setRefreshingBoth(false);
    }
  };

  const showSpinner = !reduceMotion && (pullDistance > 0 || refreshing);
  // Spinner translates with the drag; opacity fades in.
  const spinnerOpacity = refreshing
    ? 1
    : Math.min(pullDistance / threshold, 1);
  // Rotate the static refresh icon based on drag distance for a
  // "pull to load" feel; once spinning, framer takes over via class.
  const spinnerRotation = refreshing
    ? 0
    : (pullDistance / threshold) * 360;

  return (
    <>
      {/* Pull-to-refresh spinner (gesture-driven). */}
      {showSpinner && (
        <div
          aria-hidden="true"
          className="fixed left-1/2 top-3 z-[70] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#0A0A0A]/80 backdrop-blur-md"
          style={{
            transform: `translate(-50%, ${pullDistance - 20}px)`,
            opacity: spinnerOpacity,
            transition:
              pullDistance === 0 && !refreshing
                ? "opacity 0.18s ease, transform 0.2s ease"
                : undefined,
          }}
        >
          {refreshing ? (
            <Loader2 size={18} className="animate-spin text-green-300" />
          ) : (
            <RefreshCw
              size={18}
              className="text-white/70"
              style={{ transform: `rotate(${spinnerRotation}deg)` }}
            />
          )}
        </div>
      )}

      {/* Manual refresh button — always present so reduced-motion users
          and any visitors who can't trigger touch gestures still have
          a way to refresh. Sits flush to the viewport top-right. */}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={refreshing}
        aria-label="Refresh"
        className="fixed right-4 top-3 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-[#0A0A0A]/70 text-white/60 backdrop-blur-md hover:text-white/90 active:scale-90 transition-all disabled:opacity-50"
      >
        {refreshing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} />
        )}
      </button>

      {/* Body — translates down while pulling for the elastic feel. */}
      <div
        style={{
          transform: reduceMotion
            ? undefined
            : `translateY(${pullDistance}px)`,
          transition:
            !reduceMotion && pullDistance === 0 && !refreshing
              ? "transform 0.2s ease"
              : undefined,
          // Disable native iOS overscroll bounce so it doesn't fight
          // our drag handler. Keeps the gesture deterministic.
          overscrollBehaviorY: "contain",
        }}
      >
        {children}
      </div>
    </>
  );
}
