import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/catering/bookings/:id/complete
 *
 * Creator marks a balance_paid (or confirmed in rare manual cases)
 * booking as complete after the event. Sets status='completed' +
 * completed_at=now, notifies both parties (review prompt for the
 * customer, earnings recap for the creator).
 *
 * Only the creator can call this — they're the one who knows the
 * event actually happened.
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
      .select("id, creator_id, status, event_date")
      .eq("id", id)
      .single();
    if (!booking) return apiError("Booking not found.", 404);
    if (booking.creator_id !== creator.id) {
      return apiError("This booking isn't yours.", 403);
    }
    // Allow completion from confirmed or balance_paid. Don't allow
    // from balance_due (would skip the balance collection) or
    // already-completed/cancelled.
    if (booking.status !== "confirmed" && booking.status !== "balance_paid") {
      return apiError(
        `Can't complete a booking in '${booking.status}'.`,
        409
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("catering_bookings")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[bookings.complete] update failed:", updateErr.message);
      return apiError("Failed to mark complete.", 500);
    }

    // Notify both parties.
    (async () => {
      try {
        const { notifyCateringBookingCompleted } = await import(
          "@/lib/notifications"
        );
        await notifyCateringBookingCompleted({ bookingId: id });
      } catch (err) {
        console.error("[bookings.complete] notify threw:", err);
      }
    })();

    return apiSuccess({ booking_id: id, status: "completed" });
  } catch (err) {
    console.error("[bookings.complete] threw:", err);
    return apiError("Failed to mark complete.", 500);
  }
}
