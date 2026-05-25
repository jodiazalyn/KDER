import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { chargeCateringBalance } from "@/lib/catering/charge-balance";

/**
 * POST /api/v1/cron/catering-balance-charge
 *
 * Sweeps confirmed catering bookings whose balance_charge_scheduled_for
 * has elapsed and charges the saved card off-session. The whole point
 * of the deposit-flow's `setup_future_usage='off_session'` is to make
 * this possible without re-prompting the customer.
 *
 * Schedule: every 4 hours (migration 014). Failures flip status to
 * 'balance_due' so the creator + customer can manually retry from the
 * dashboard.
 *
 * Retry policy: we only auto-retry up to 3 times (balance_attempt_count
 * < 3). Beyond that the booking stays in balance_due and waits for a
 * manual retry from the creator.
 */

const MAX_AUTO_RETRIES = 3;

async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/balance-charge] CRON_SECRET not configured");
    return apiError("Cron not configured.", 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return apiError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  if (!supabase) return apiError("Service client unavailable.", 500);

  // Find confirmed bookings whose balance is due and haven't been
  // charged yet. Also include balance_due bookings under the retry cap
  // so transient failures (network blip, temporary card hold) get
  // another try without manual intervention.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from("catering_bookings")
    .select(`
      id, creator_id, member_id, status, event_date,
      total_cents, balance_cents,
      stripe_customer_id, balance_payment_method_id,
      balance_charge_scheduled_for, balance_charged_at,
      balance_attempt_count,
      creator:creators(stripe_connect_id)
    `)
    .in("status", ["confirmed", "balance_due"])
    .is("balance_charged_at", null)
    .lt("balance_charge_scheduled_for", new Date().toISOString())
    .lt("balance_attempt_count", MAX_AUTO_RETRIES);

  if (error) {
    console.error("[cron/balance-charge] query failed:", error.message);
    return apiError("Query failed.", 500);
  }

  const bookings = (rows ?? []) as Array<{
    id: string;
    creator_id: string;
    member_id: string;
    status: string;
    event_date: string;
    total_cents: number;
    balance_cents: number;
    stripe_customer_id: string | null;
    balance_payment_method_id: string | null;
    balance_charge_scheduled_for: string;
    balance_charged_at: string | null;
    balance_attempt_count: number;
    creator: { stripe_connect_id: string | null } | null;
  }>;

  let charged = 0;
  let failed = 0;

  for (const b of bookings) {
    const result = await chargeCateringBalance({
      bookingId: b.id,
      creatorId: b.creator_id,
      balanceCents: b.balance_cents,
      stripeCustomerId: b.stripe_customer_id,
      balancePaymentMethodId: b.balance_payment_method_id,
      creatorStripeConnectId: b.creator?.stripe_connect_id ?? null,
    });
    if (result.ok) charged++;
    else failed++;

    // Always record the attempt. Whether success or failure, we want
    // visibility into how many tries this booking has had.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("catering_bookings")
      .update({
        status: result.ok ? "balance_paid" : "balance_due",
        balance_payment_intent_id: result.paymentIntentId ?? null,
        balance_charged_at: result.ok ? new Date().toISOString() : null,
        last_balance_attempt_at: new Date().toISOString(),
        balance_attempt_count: b.balance_attempt_count + 1,
        balance_failure_message: result.ok ? null : result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", b.id);

    // Fire the right notification. notifyCateringBalanceCharged on
    // success, notifyCateringBalanceFailed on failure (with the
    // retry-link path for the customer).
    try {
      if (result.ok) {
        const { notifyCateringBalanceCharged } = await import(
          "@/lib/notifications"
        );
        await notifyCateringBalanceCharged({ bookingId: b.id });
      } else {
        const { notifyCateringBalanceFailed } = await import(
          "@/lib/notifications"
        );
        await notifyCateringBalanceFailed({
          bookingId: b.id,
          reason: result.error,
          finalAttempt: b.balance_attempt_count + 1 >= MAX_AUTO_RETRIES,
        });
      }
    } catch (err) {
      console.error("[cron/balance-charge] notify threw:", err);
    }
  }

  console.log(
    `[cron/balance-charge] swept ${bookings.length}, charged ${charged}, failed ${failed}`
  );

  return apiSuccess({ scanned: bookings.length, charged, failed });
}

export const GET = handle;
export const POST = handle;
