/**
 * Motion presets for the Apple Liquid Glass aesthetic.
 *
 * Use these constants instead of hand-rolling spring/easing values
 * across the app. They were chosen to match iOS feel:
 *
 *   - Sheets / modals: a soft entry/exit that settles without bounce
 *   - Press / tap feedback: tight + snappy, no overshoot
 *   - List items / staggered appearance: gentler, slightly springy
 *
 * iOS_EASING is a cubic bezier approximation for places where CSS
 * transitions or Tailwind animations are still in use (sheet/dialog
 * Radix-based animations). Use the spring presets when you have a
 * framer-motion `<motion.div>`.
 *
 * Honors `prefers-reduced-motion` globally via globals.css (which
 * clamps animation/transition durations to 0.01ms). No per-component
 * code needed.
 */

import type { Transition } from "framer-motion";

/**
 * Cubic bezier control points used by Apple for iOS sheets, alerts,
 * and modal transitions. Use as `ease: IOS_EASING` on a framer-motion
 * transition or as the `cubic-bezier(...)` arg in CSS.
 */
export const IOS_EASING = [0.32, 0.72, 0, 1] as const;

/**
 * Sheet / modal entry + exit. Soft settle, no overshoot. Pair with
 * fade + slide on the same `<motion.div>`.
 */
export const SPRING_SHEET = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} satisfies Transition;

/**
 * Press / tap feedback (e.g., button scale on active). Tight + snappy.
 * Use for transforms that should feel "instant" but with a tiny
 * physics-based settle.
 */
export const SPRING_PRESS = {
  type: "spring",
  stiffness: 600,
  damping: 35,
} satisfies Transition;

/**
 * List item entrance / staggered appearance. Slightly springier than
 * sheet to give items a little life as they cascade in.
 */
export const SPRING_LIST = {
  type: "spring",
  stiffness: 300,
  damping: 25,
} satisfies Transition;

/**
 * Default stagger config for list children. Keeps list reveals
 * coordinated without being slow. Use as `transition.staggerChildren`
 * on the parent.
 */
export const STAGGER_CHILDREN = {
  staggerChildren: 0.05,
  delayChildren: 0.05,
} as const;

/**
 * Standard durations (ms) for places where springs aren't a fit
 * (CSS-only transitions, Tailwind animate-in/animate-out durations).
 */
export const DURATION = {
  /** Snappy press / hover-fade. */
  fast: 150,
  /** Default UI state change. */
  base: 220,
  /** Sheet/modal entry. iOS feels closer to ~380ms than the
   *  sometimes-default 500ms which reads as sluggish. */
  sheet: 380,
  /** Sheet/modal exit. Slightly faster than entry per iOS norms. */
  sheetExit: 280,
} as const;
