import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";

/**
 * Shared off-session balance-charge logic. Lives in lib/ so it can be
 * called from:
 *   - the cron sweep (every 4 hours, auto-retries up to MAX_AUTO_RETRIES)
 *   - the manual retry endpoint (creator-triggered, ignores the cap)
 *
 * Why off-session: we set `setup_future_usage='off_session'` when the
 * customer paid the deposit, which lets us run this charge later
 * without prompting them. If they have 3DS on their card, off-session
 * will return `requires_action` and we surface that as a failure — the
 * customer then needs to retry on-session in the app (deferred to a
 * follow-up).
 */

export interface BalanceChargeInput {
  bookingId: string;
  creatorId: string;
  balanceCents: number;
  stripeCustomerId: string | null;
  balancePaymentMethodId: string | null;
  creatorStripeConnectId: string | null;
}

export type BalanceChargeResult =
  | { ok: true; paymentIntentId: string }
  | { ok: false; paymentIntentId?: string; error: string };

export async function chargeCateringBalance(
  input: BalanceChargeInput
): Promise<BalanceChargeResult> {
  const {
    bookingId,
    creatorId,
    balanceCents,
    stripeCustomerId,
    balancePaymentMethodId,
    creatorStripeConnectId,
  } = input;

  // Pre-flight
  if (!stripeCustomerId || !balancePaymentMethodId) {
    return {
      ok: false,
      error: "Missing saved card — customer needs to re-enter payment.",
    };
  }
  if (!creatorStripeConnectId) {
    return {
      ok: false,
      error: "Creator's Stripe Connect account isn't ready.",
    };
  }
  if (balanceCents <= 0) {
    return { ok: false, error: "Balance is zero — nothing to charge." };
  }

  const platformFeeCents = Math.round(
    balanceCents * (PLATFORM_FEE_PERCENT / 100)
  );

  try {
    const intent = await stripe.paymentIntents.create({
      amount: balanceCents,
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: balancePaymentMethodId,
      off_session: true,
      confirm: true,
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: creatorStripeConnectId },
      metadata: {
        type: "catering_balance",
        booking_id: bookingId,
        creator_id: creatorId,
      },
    });

    if (intent.status === "succeeded") {
      return { ok: true, paymentIntentId: intent.id };
    }

    return {
      ok: false,
      paymentIntentId: intent.id,
      error: `Payment ${intent.status} — customer needs to confirm in the app.`,
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    const message =
      e?.raw?.message || e?.message || "Stripe charge failed for unknown reason.";
    return {
      ok: false,
      paymentIntentId: e?.raw?.payment_intent?.id,
      error: message,
    };
  }
}
