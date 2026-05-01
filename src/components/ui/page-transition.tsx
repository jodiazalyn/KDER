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
 */
const SLIDE_DURATION = 0.22; // seconds
const FADE_DURATION = 0.12; // reduced-motion fallback

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

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
