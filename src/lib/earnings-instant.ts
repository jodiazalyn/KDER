import type {
  EarningsAccountInfo,
  EarningsBalance,
  InstantPayoutState,
} from "./earnings-types";

/**
 * Resolve whether a creator can run an instant payout right now, and
 * if not, which reason to surface to the UI. Pre-flight gate — runs
 * with whatever data we already have on the page; no extra Stripe
 * round-trip.
 *
 * Order matters: check no_balance first (button shouldn't render at
 * all), then no_debit_card (concrete fix), then not_enabled (Stripe-
 * approval issue, less actionable).
 */
export function getInstantPayoutState({
  balance,
  account,
}: {
  balance: EarningsBalance | null;
  account: EarningsAccountInfo | null;
}): InstantPayoutState {
  if (!balance || balance.availableCents <= 0) {
    return { kind: "no_balance" };
  }
  if (!account || !account.hasInstantEligibleCard) {
    return { kind: "no_debit_card" };
  }
  // If Stripe reports zero instant_available despite us having balance
  // and a card, instant payouts haven't been approved on this account.
  if (balance.instantAvailableCents <= 0) {
    return { kind: "not_enabled" };
  }
  return { kind: "available" };
}

/**
 * Stripe error codes that should switch the InstantPayoutSheet into the
 * `not_enabled` explainer view rather than just showing a toast. Used
 * as a post-tap fallback in case pre-flight missed the state (e.g.
 * Stripe's instant_available was non-zero at page-load but the
 * underwriting check fails at create time).
 */
export const NOT_ENABLED_STRIPE_CODES = new Set([
  "instant_payouts_limit_exceeded",
  "instant_payouts_unsupported",
  "payouts_not_allowed",
]);
