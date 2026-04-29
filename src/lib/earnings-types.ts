// Shared types for the earnings tab.
//
// Money on the wire: integer cents. Convert to dollars at the UI
// boundary (`(cents / 100).toFixed(2)`). Sum integers, never floats —
// floating-point drift on money is a footgun.

export type StripeKycStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";

export type PayoutMethod = "standard" | "instant";

export type PayoutStatus = "pending" | "paid" | "failed";

export type PayoutScheduleInterval = "daily" | "weekly" | "manual";

/** Stripe `balance.retrieve` reduced to USD only. */
export interface EarningsBalance {
  availableCents: number;
  pendingCents: number;
  currency: string; // 'usd'
}

/** A row in the payout history list. */
export interface EarningsPayout {
  id: string; // stripe payout id (po_...)
  amountCents: number;
  feeCents: number;
  method: PayoutMethod;
  status: PayoutStatus;
  arrivalDate: string | null; // ISO
  failureReason: string | null;
  createdAt: string; // ISO
}

/** Resolved Stripe Connect account info needed for the Earn page UI. */
export interface EarningsAccountInfo {
  kycStatus: StripeKycStatus;
  payoutsEnabled: boolean;
  /**
   * True iff the account has at least one card external_account.
   * Required for instant payouts; bank-only accounts can't use
   * `method: 'instant'`. Pre-flight gate for the Instant button.
   */
  hasInstantEligibleCard: boolean;
  defaultCurrency: string;
  schedule: {
    interval: PayoutScheduleInterval;
    weeklyAnchor: string | null; // 'monday' | 'tuesday' | ... when interval=weekly
    delayDays: number | null;
  };
  /** Heuristic next-payout date based on schedule. Null when manual. */
  nextPayoutDate: string | null;
  /** Number of items in account.requirements.currently_due. */
  currentlyDueCount: number;
  /** Stripe's `disabled_reason`, e.g. `requirements.past_due`. */
  disabledReason: string | null;
}

/** 3 tiles in the LifetimeStatsCard. All cents. */
export interface EarningsLifetime {
  grossSoldCents: number;
  paidOutCents: number;
  netPendingCents: number;
}

/** A single TransactionRow on the Earn page. Sourced from DB orders. */
export interface EarningsTransaction {
  id: string; // order id (uuid)
  date: string; // ISO
  plateName: string;
  memberName: string;
  orderTotalCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  status: "paid" | "pending" | "held" | "refunded";
  refundAmountCents: number;
  paymentIntentId: string | null;
}

export type EarningsErrorSection = "balance" | "payouts" | "account" | "lifetime";

export interface EarningsData {
  /**
   * False when the creator hasn't started Stripe Connect onboarding yet.
   * The Earn page renders a setup CTA instead of the full UI in that case.
   */
  hasConnectAccount: boolean;
  balance: EarningsBalance | null;
  payouts: EarningsPayout[];
  account: EarningsAccountInfo | null;
  lifetime: EarningsLifetime | null;
  transactions: EarningsTransaction[];
  /**
   * Per-section error map. Keyed by section, value is the Stripe error
   * code (e.g. `account_invalid`) so the UI can show "[code]" in the
   * error toast/banner. Sections not present here loaded successfully.
   */
  errors: Partial<Record<EarningsErrorSection, string>>;
}
