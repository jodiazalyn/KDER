import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { chargeCateringBalance } from "@/lib/catering/charge-balance";

/**
 * POST /api/v1/catering/bookings/:id/retry-balance
 *
 * Creator-triggered manual retry for a balance_due booking. Bypasses
 * the cron's 3-attempt auto-retry cap — sometimes the creator knows
 * the customer fixed their card and wants to try right away rather
 * than wait for the next sweep.
 *
 * Same charge logic as the cron, just called on demand.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single();
    if (!creator) return apiError("Creator profile not found.", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, creator_id, status, balance_cents,
        stripe_customer_id, balance_payment_method_id,
        balance_attempt_count,
        creator:creators(stripe_connect_id)
      `)
      .eq("id", id)
      .single();
    if (!booking) return apiError("Booking not found.", 404);
    if (booking.creator_id !== creator.id) {
      return apiError("This booking isn't yours.", 403);
    }
    if (booking.status !== "balance_due" && booking.status !== "confirmed") {
      return apiError(
        `Can't retry from '${booking.status}'.`,
        409
      );
    }

    const result = await chargeCateringBalance({
      bookingId: booking.id,
      creatorId: booking.creator_id,
      balanceCents: booking.balance_cents,
      stripeCustomerId: booking.stripe_customer_id,
      balancePaymentMethodId: booking.balance_payment_method_id,
      creatorStripeConnectId: booking.creator?.stripe_connect_id ?? null,
    });

    // Persist + notify (mirror the cron handler's tail).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("catering_bookings")
      .update({
        status: result.ok ? "balance_paid" : "balance_due",
        balance_payment_intent_id: result.paymentIntentId ?? null,
        balance_charged_at: result.ok ? new Date().toISOString() : null,
        last_balance_attempt_at: new Date().toISOString(),
        balance_attempt_count: booking.balance_attempt_count + 1,
        balance_failure_message: result.ok ? null : result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    try {
      if (result.ok) {
        const { notifyCateringBalanceCharged } = await import(
          "@/lib/notifications"
        );
        await notifyCateringBalanceCharged({ bookingId: id });
      } else {
        const { notifyCateringBalanceFailed } = await import(
          "@/lib/notifications"
        );
        // Manual retry is never the "final attempt" since creator can
        // keep trying — pass false so the customer email keeps the
        // friendly "we'll try again" tone.
        await notifyCateringBalanceFailed({
          bookingId: id,
          reason: result.ok ? "" : result.error,
          finalAttempt: false,
        });
      }
    } catch (err) {
      console.error("[retry-balance] notify threw:", err);
    }

    if (result.ok) {
      return apiSuccess({ booking_id: id, status: "balance_paid" });
    }
    return apiError(result.error, 402);
  } catch (err) {
    console.error("[retry-balance] threw:", err);
    return apiError("Couldn't retry the charge.", 500);
  }
}
