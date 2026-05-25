import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/catering/bookings/:id/decline
 *
 * Creator explicitly declines a pending_acceptance booking. Marks the
 * booking cancelled, refunds the deposit on the connected account, and
 * notifies both parties.
 *
 * Same handler is reused by the acceptance-deadline cron (it imports
 * the helper below). Always-refund per spec: deposit is forfeitable
 * AFTER the creator accepts, not before.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : "The creator declined this booking.";

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
      .select("id, creator_id, status, deposit_payment_intent_id, quote_id")
      .eq("id", id)
      .single();
    if (!booking) return apiError("Booking not found.", 404);

    if (booking.creator_id !== creator.id) {
      return apiError("This booking isn't yours to decline.", 403);
    }
    if (booking.status !== "pending_acceptance") {
      return apiError(
        `Booking is in '${booking.status}', can't decline.`,
        409
      );
    }

    const ok = await cancelAndRefundBooking({
      bookingId: id,
      paymentIntentId: booking.deposit_payment_intent_id,
      quoteId: booking.quote_id,
      reason,
    });
    if (!ok) {
      return apiError("Failed to decline booking — refund didn't complete.", 500);
    }

    return apiSuccess({ booking_id: id, status: "cancelled" });
  } catch (err) {
    console.error("[bookings.decline] threw:", err);
    return apiError("Failed to decline booking.", 500);
  }
}

/**
 * Shared cancellation helper. Used by:
 *   - this endpoint (creator-initiated decline)
 *   - the acceptance-deadline cron (auto-decline after 4h)
 *
 * Refunds the deposit via Stripe (reversing the application fee too so
 * the platform doesn't keep money on a cancelled booking), updates the
 * booking + quote rows, and fires the cancellation email.
 */
export async function cancelAndRefundBooking(args: {
  bookingId: string;
  paymentIntentId: string;
  quoteId: string;
  reason: string;
}): Promise<boolean> {
  const { bookingId, paymentIntentId, quoteId, reason } = args;
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[cancelAndRefund] no service client");
    return false;
  }

  // Refund the deposit. `reverse_transfer: true` pulls the funds back
  // from the creator's connected account; `refund_application_fee: true`
  // reverses our platform fee so we don't profit on a cancelled booking.
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { type: "catering_deposit_refund", booking_id: bookingId },
    });
  } catch (err) {
    console.error("[cancelAndRefund] refund failed:", err);
    return false;
  }

  // Flip statuses. Even if Stripe partially failed above we'd want to
  // re-try the refund; for now, we only mark cancelled when the refund
  // succeeded so admins can see "stuck" bookings = stuck refunds.
  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("catering_bookings")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("catering_quotes")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", quoteId),
  ]);

  // Notify both parties.
  try {
    const { notifyCateringBookingCancelled } = await import(
      "@/lib/notifications"
    );
    await notifyCateringBookingCancelled({ bookingId, reason });
  } catch (err) {
    console.error("[cancelAndRefund] notify threw:", err);
  }

  return true;
}
