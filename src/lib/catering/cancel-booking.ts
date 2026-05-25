import { stripe } from "@/lib/stripe/client";

/**
 * Shared cancellation helper for catering bookings.
 *
 * Lives in lib/ (not in a route file) because Next.js App Router only
 * permits HTTP method exports from route.ts files — exporting helpers
 * from a route is a build error.
 *
 * Used by:
 *   - POST /api/v1/catering/bookings/[id]/decline (creator-initiated)
 *   - POST /api/v1/cron/catering-acceptance-deadline (auto-decline)
 *
 * Refunds the deposit via Stripe (reversing the application fee + the
 * connected-account transfer so the platform doesn't keep money on a
 * cancelled booking), updates the booking + quote rows, and fires the
 * cancellation email to both parties.
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
  // from the creator's connected account; `refund_application_fee:
  // true` reverses our platform fee so we don't profit on a cancelled
  // booking.
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

  // Only mark cancelled when the refund succeeded — leaves "stuck"
  // bookings visible to admins if Stripe is having a bad day.
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
