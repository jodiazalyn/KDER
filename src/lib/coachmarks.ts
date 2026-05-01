/**
 * Central registry of coachmark IDs + copy. One source of truth so
 * we can audit / search / update tip text without chasing strings
 * across feature components.
 *
 * Each ID maps to a single first-time-user tip that auto-shows once
 * on its surface and never again (localStorage-keyed dismissal). The
 * matching `<InfoTip>` instances scattered through the UI provide
 * the same copy as a re-readable hint.
 *
 * Adding a new coachmark:
 *   1. Pick a kebab-case id like `creator-feature-key-action`
 *   2. Add it here with copy
 *   3. Render `<Coachmark id="..." copy={COACHMARK_COPY['...']} targetRef={...} />`
 *      next to the relevant element in the surface
 */

export const COACHMARK_COPY = {
  // ── Creator-side ──────────────────────────────────────────────
  "creator-plate-title":
    "A specific name sells better. \"Smoked brisket plate w/ slaw\" beats \"BBQ plate.\"",
  "creator-plate-photos":
    "Customers buy with their eyes. Bright, top-down shots convert about 3× more than dim or angled ones.",
  "creator-earn-balance":
    "This is what you've earned but Stripe hasn't sent yet. Tap Instant for a payout in ~30 minutes.",
  "creator-orders-pending":
    "Accept within 15 minutes or the order auto-declines and clears from this list.",

  // ── Customer-side ─────────────────────────────────────────────
  "customer-storefront-tile":
    "Tap a plate to see ingredients, allergens, and pickup or delivery options before you buy.",
  "customer-order-status":
    "You'll get an SMS at every step. Message the creator below for any questions about your order.",
} as const satisfies Record<string, string>;

export type CoachmarkId = keyof typeof COACHMARK_COPY;

const STORAGE_PREFIX = "kder_coachmark_";

/** Read whether a coachmark has already been dismissed by this user. */
export function isCoachmarkDismissed(id: CoachmarkId): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    return true;
  }
}

/** Mark a coachmark as dismissed forever for this user. */
export function dismissCoachmark(id: CoachmarkId): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, "1");
  } catch {
    // localStorage unavailable (private mode) — coachmark will re-show
    // on next visit. Acceptable; we don't break.
  }
}

/**
 * Test-only / settings reset: clear ALL coachmark dismissals so they
 * re-show on next visit. Not exposed in the UI today, but available
 * for a future "Reset onboarding tips" affordance.
 */
export function resetAllCoachmarks(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // non-fatal
  }
}
