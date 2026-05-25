import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { cancelAndRefundBooking } from "@/lib/catering/cancel-booking";

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

