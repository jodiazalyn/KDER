"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Page transitions for the (app) authed shell.
 *
 *   Forward / back / any nav: incoming slides in from right, outgoing
 *   slides out left, ~220ms.
 *
 *   Honors `prefers-reduced-motion` by falling back to a short fade.
 *
 * Why not direction-aware (back-vs-forward)? Detecting direction
 * synchronously without `setState`-in-effect (which the strict React
 * 19 lint flags) requires reading refs during render (also flagged).
 * A single direction is the pragmatic call: still a pleasant native
 * feel, no lint fight, no cascading-render risk. Direction-aware can
 * be a follow-up if we ever feel its absence.
 *
 * Why a `template.tsx` wrapper rather than `layout.tsx`: App Router
 * remounts templates on every navigation but reuses layouts. Mounting
 * a fresh `motion.div` with a new key is what AnimatePresence needs
 * to detect the route change.
 *
 * Performance: transform-only animations (translateX). GPU-accelerated.
 * `will-change: transform` hints the compositor.
 *
 * ── GOTCHA: fullscreen-overlay routes ─────────────────────────────
 *
 * framer-motion uses `transform: translateX(...)` to slide. CSS spec
 * rule: any element with a non-`none` `transform` becomes a new
 * containing block for descendant `position: fixed` elements. So a
 * descendant `<main className="fixed inset-0">` stops being viewport-
 * fixed and gets positioned relative to the motion.div instead —
 * which collapses the layout (input bar floats to top, content
 * disappears off-screen, etc.).
 *
 * Routes that use `position: fixed inset-0` for fullscreen modal-
 * style takeovers must opt out of the wrapper. Add their patterns
 * to FULLSCREEN_OVERLAY_PATTERNS below. They render without
 * transition — which is fine because slide-into-modal doesn't
 * actually feel right anyway.
 */

const SLIDE_DURATION = 0.22; // seconds
const FADE_DURATION = 0.12; // reduced-motion fallback

/**
 * Pathname prefixes (or RegExps) that should NOT be wrapped in the
 * transition motion.div because they use `position: fixed inset-0`
 * for fullscreen takeover layouts. Add patterns here when introducing
 * new fullscreen-overlay routes.
 */
const FULLSCREEN_OVERLAY_PATTERNS: (string | RegExp)[] = [
  /^\/messages\/[^/]+$/, // chat thread fullscreen takeover
];

function isFullscreenOverlayRoute(pathname: string): boolean {
  return FULLSCREEN_OVERLAY_PATTERNS.some((p) =>
    typeof p === "string" ? pathname.startsWith(p) : p.test(pathname)
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  // Fullscreen overlays bypass the motion wrapper entirely — see GOTCHA
  // in the file header.
  if (isFullscreenOverlayRoute(pathname)) {
    return <>{children}</>;
  }

  const variants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "-100%" },
      };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{
          duration: reduceMotion ? FADE_DURATION : SLIDE_DURATION,
          ease: [0.32, 0.72, 0, 1], // iOS-like cubic-bezier
        }}
        style={{ willChange: "transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
