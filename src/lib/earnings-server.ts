import "server-only";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import type {
  EarningsAccountInfo,
  EarningsBalance,
  EarningsData,
  EarningsLifetime,
  EarningsPayout,
  EarningsTransaction,
  PayoutMethod,
  PayoutScheduleInterval,
  PayoutStatus,
  StripeKycStatus,
} from "@/lib/earnings-types";

const PAYOUT_HISTORY_LIMIT = 10;

/**
 * Server-only fan-out util for the Earn tab.
 *
 * Promise.all'd across 4 sources:
 *   1. Stripe balance.retrieve   (balance section)
 *   2. Stripe payouts.list       (payout history)
 *   3. Stripe accounts.retrieve  (KYC + schedule + external accounts)
 *   4. Supabase orders + payouts (lifetime stats + transactions)
 *
 * Each section catches its own errors so a single Stripe blip doesn't
 * crash the page. Failed sections appear in `data.errors[section]`
 * with the Stripe error code; the UI renders inline error states for
 * those while populating the rest normally.
 *
 * Throws only on auth/creator-resolution failures — those are 401/404
 * cases that the route handler maps to status codes. Page-level errors
 * are reported per-section.
 */
export async function loadEarningsData(): Promise<EarningsData> {
  // Dev environments without Supabase configured will throw at createClient.
  // Surface as a distinct error the page can render a setup-required state
  // for, rather than a 500. (Production sets these env vars.)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("env_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("not_authenticated");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = (await (supabase as any)
    .from("creators")
    .select(
      "id, stripe_connect_id, kyc_status, payouts_enabled, default_currency"
    )
    .eq("member_id", user.id)
    .single()) as {
    data: {
      id: string;
      stripe_connect_id: string | null;
      kyc_status: StripeKycStatus | null;
      payouts_enabled: boolean | null;
      default_currency: string | null;
    } | null;
  };

  if (!creator) {
    throw new Error("creator_not_found");
  }

  const stripeAccountId = creator.stripe_connect_id;

  // No Connect account yet → render the "Set Up Payouts" CTA, skip
  // every Stripe call. Lifetime stats from DB are still useful (any
  // legacy completed orders show up).
  if (!stripeAccountId) {
    const dbBundle = await loadDbBundle(creator.id);
    return {
      hasConnectAccount: false,
      balance: null,
      payouts: [],
      account: {
        kycStatus: creator.kyc_status ?? "not_started",
        payoutsEnabled: false,
        hasInstantEligibleCard: false,
        defaultCurrency: creator.default_currency ?? "usd",
        schedule: { interval: "daily", weeklyAnchor: null, delayDays: null },
        nextPayoutDate: null,
        currentlyDueCount: 0,
        disabledReason: null,
      },
      lifetime: dbBundle.lifetime,
      transactions: dbBundle.transactions,
      errors: {},
    };
  }

  // ── Parallel fan-out ──────────────────────────────────────────
  const [balanceResult, payoutsResult, accountResult, dbResult] =
    await Promise.allSettled([
      stripe.balance.retrieve({}, { stripeAccount: stripeAccountId }),
      stripe.payouts.list(
        { limit: PAYOUT_HISTORY_LIMIT },
        { stripeAccount: stripeAccountId }
      ),
      stripe.accounts.retrieve(stripeAccountId),
      loadDbBundle(creator.id),
    ]);

  const errors: EarningsData["errors"] = {};

  const balance =
    balanceResult.status === "fulfilled"
      ? shapeBalance(balanceResult.value)
      : (errors.balance = stripeCode(balanceResult.reason), null);

  const payouts =
    payoutsResult.status === "fulfilled"
      ? payoutsResult.value.data.map(shapePayout)
      : (errors.payouts = stripeCode(payoutsResult.reason), []);

  const account =
    accountResult.status === "fulfilled"
      ? shapeAccount(
          accountResult.value,
          creator.kyc_status ?? "not_started",
          balance
        )
      : (errors.account = stripeCode(accountResult.reason), null);

  // DB section: lifetime + transactions. If this fails we still want
  // the rest of the page; surface the error.
  let lifetime: EarningsLifetime | null = null;
  let transactions: EarningsTransaction[] = [];
  if (dbResult.status === "fulfilled") {
    lifetime = dbResult.value.lifetime;
    transactions = dbResult.value.transactions;
  } else {
    errors.lifetime = "db_error";
    console.error("[earnings] DB bundle failed:", dbResult.reason);
  }

  return {
    hasConnectAccount: true,
    balance,
    payouts,
    account,
    lifetime,
    transactions,
    errors,
  };
}

// ── Shape helpers ─────────────────────────────────────────────

function shapeBalance(balance: Stripe.Balance): EarningsBalance {
  // Connect Express US is USD-only by default. Sum the USD entry only;
  // assert + warn on non-USD entries so we notice if multi-currency
  // gets enabled later.
  const usdAvail = balance.available.find((b) => b.currency === "usd");
  const usdPending = balance.pending.find((b) => b.currency === "usd");
  // `instant_available` is only present on accounts Stripe has approved
  // for instant payouts. Missing/empty/zero means instant isn't unlocked
  // yet — pre-flight gate.
  const usdInstant = balance.instant_available?.find(
    (b) => b.currency === "usd"
  );

  const nonUsd = [
    ...balance.available.filter((b) => b.currency !== "usd"),
    ...balance.pending.filter((b) => b.currency !== "usd"),
  ];
  if (nonUsd.length > 0) {
    console.warn(
      "[earnings] non-USD balance entries detected; UI will only show USD",
      nonUsd.map((b) => b.currency)
    );
  }

  return {
    availableCents: usdAvail?.amount ?? 0,
    pendingCents: usdPending?.amount ?? 0,
    instantAvailableCents: usdInstant?.amount ?? 0,
    currency: "usd",
  };
}

function shapePayout(payout: Stripe.Payout): EarningsPayout {
  // Stripe payout.status values: paid, pending, in_transit, canceled, failed.
  // Collapse in_transit/canceled into our 3-value enum.
  const status: PayoutStatus =
    payout.status === "paid"
      ? "paid"
      : payout.status === "failed" || payout.status === "canceled"
        ? "failed"
        : "pending";

  const method: PayoutMethod =
    payout.method === "instant" ? "instant" : "standard";

  return {
    id: payout.id,
    amountCents: payout.amount,
    feeCents: payout.application_fee_amount ?? 0,
    method,
    status,
    arrivalDate: payout.arrival_date
      ? new Date(payout.arrival_date * 1000).toISOString()
      : null,
    failureReason:
      payout.status === "canceled"
        ? payout.failure_message ?? "Cancelled in Stripe"
        : payout.failure_message ?? null,
    createdAt: new Date(payout.created * 1000).toISOString(),
  };
}

function shapeAccount(
  account: Stripe.Account,
  cachedKyc: StripeKycStatus,
  balance: EarningsBalance | null
): EarningsAccountInfo {
  const live: StripeKycStatus =
    account.charges_enabled && account.payouts_enabled
      ? "verified"
      : account.requirements?.disabled_reason
        ? "failed"
        : "pending";

  // Stripe sometimes lags behind the DB cache; prefer the live read.
  const kycStatus = live ?? cachedKyc;

  const externalAccounts = account.external_accounts?.data ?? [];
  const hasInstantEligibleCard = externalAccounts.some(
    (ea) => ea.object === "card"
  );

  const schedule = account.settings?.payouts?.schedule;
  const interval: PayoutScheduleInterval =
    schedule?.interval === "manual"
      ? "manual"
      : schedule?.interval === "weekly"
        ? "weekly"
        : "daily";

  return {
    kycStatus,
    payoutsEnabled: Boolean(account.payouts_enabled),
    hasInstantEligibleCard,
    defaultCurrency: account.default_currency ?? "usd",
    schedule: {
      interval,
      weeklyAnchor: schedule?.weekly_anchor ?? null,
      delayDays:
        typeof schedule?.delay_days === "number" ? schedule.delay_days : null,
    },
    nextPayoutDate: estimateNextPayoutDate(interval, schedule, balance),
    currentlyDueCount: account.requirements?.currently_due?.length ?? 0,
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
}

/**
 * Heuristic next-payout date. Stripe doesn't expose this directly, but
 * for the common Daily/Weekly automatic schedules we can compute the
 * next anchor. Manual returns null (UI shows "Manual — pull on demand").
 */
function estimateNextPayoutDate(
  interval: PayoutScheduleInterval,
  schedule: Stripe.Account.Settings.Payouts.Schedule | undefined,
  balance: EarningsBalance | null
): string | null {
  if (interval === "manual") return null;
  // Don't promise a date if there's nothing to pay out.
  if (!balance || balance.availableCents + balance.pendingCents <= 0) {
    return null;
  }

  const now = new Date();
  if (interval === "daily") {
    // Stripe's daily payouts cut over each business day; estimate as
    // tomorrow. Reasonable approximation; UI says "~".
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    return next.toISOString();
  }

  // Weekly: find the next occurrence of weekly_anchor.
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const targetDow = dayMap[schedule?.weekly_anchor ?? "monday"] ?? 1;
  const todayDow = now.getDay();
  let delta = (targetDow - todayDow + 7) % 7;
  if (delta === 0) delta = 7; // skip today; next week's anchor
  const next = new Date(now);
  next.setDate(now.getDate() + delta);
  return next.toISOString();
}

// ── DB bundle ─────────────────────────────────────────────────

async function loadDbBundle(creatorId: string): Promise<{
  lifetime: EarningsLifetime;
  transactions: EarningsTransaction[];
}> {
  const supabase = await createClient();

  // Pull all completed/refunded orders for this creator. We compute
  // lifetime stats AND build the Transactions list from the same query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersData, error: ordersErr } = await (supabase as any)
    .from("orders")
    .select(
      "id, status, total_amount, platform_fee, creator_payout, refund_amount, member_name, items, stripe_payment_intent_id, created_at, listing:listings(name)"
    )
    .eq("creator_id", creatorId)
    .in("status", ["accepted", "ready", "completed", "cancelled"])
    .order("created_at", { ascending: false });

  if (ordersErr) {
    throw new Error(`orders query failed: ${ordersErr.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: any[] = ordersData ?? [];

  // Lifetime: paid out comes from the payouts table (Stripe is canonical
  // but our DB mirror is what the page uses since we already query it).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payoutRows } = await (supabase as any)
    .from("payouts")
    .select("amount_cents, amount, status")
    .eq("creator_id", creatorId)
    .eq("status", "paid");

  const paidOutCents =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payoutRows ?? []).reduce((sum: number, p: any) => {
      const cents =
        typeof p.amount_cents === "number"
          ? p.amount_cents
          : Math.round(Number(p.amount ?? 0) * 100);
      return sum + cents;
    }, 0);

  let grossSoldCents = 0;
  let netPendingCents = 0;
  const transactions: EarningsTransaction[] = [];

  for (const row of orders) {
    const totalCents = toCents(row.total_amount);
    const feeCents = toCents(row.platform_fee);
    const payoutCents = toCents(row.creator_payout);
    const refundCents = toCents(row.refund_amount);

    const isRefunded = row.status === "cancelled" && refundCents > 0;

    if (!isRefunded) {
      grossSoldCents += totalCents;
      // "Net pending" per decisions: orders not yet paid out =
      // creator_payout for completed-but-not-yet-refunded orders.
      // We don't try to match individual orders to specific payouts;
      // approximate as total earnings minus total paid out.
      netPendingCents += payoutCents;
    }

    const txStatus: EarningsTransaction["status"] = isRefunded
      ? "refunded"
      : row.status === "completed"
        ? "paid"
        : row.status === "ready" || row.status === "accepted"
          ? "held"
          : "pending";

    const firstItem =
      Array.isArray(row.items) && row.items.length > 0 ? row.items[0] : null;
    const plateName =
      firstItem?.name ?? row.listing?.name ?? "Plate";

    transactions.push({
      id: row.id,
      date: row.created_at,
      plateName,
      memberName: row.member_name ?? "Customer",
      orderTotalCents: totalCents,
      platformFeeCents: feeCents,
      netPayoutCents: payoutCents,
      status: txStatus,
      refundAmountCents: refundCents,
      paymentIntentId: row.stripe_payment_intent_id ?? null,
    });
  }

  // netPending = lifetime earnings (creator_payout sums) minus paid out.
  // Floor at 0; if Stripe paid out more than our DB knows about (cancelled
  // orders, manual adjustments), we don't show a negative tile.
  netPendingCents = Math.max(0, netPendingCents - paidOutCents);

  return {
    lifetime: {
      grossSoldCents,
      paidOutCents,
      netPendingCents,
    },
    transactions,
  };
}

function toCents(value: unknown): number {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  return 0;
}

function stripeCode(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return err.code ?? err.type ?? "stripe_error";
  }
  if (err instanceof Error) return err.message.slice(0, 64);
  return "unknown_error";
}
