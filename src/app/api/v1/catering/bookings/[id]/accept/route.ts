import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/catering/bookings/:id/accept
 *
 * Creator confirms a pending_acceptance booking. Locks in:
 *   - status='confirmed'
 *   - balance_charge_scheduled_for = event_date - creator.catering_balance_days_before
 *     (PR 4's cron sweeps this column to auto-charge the balance)
 *
 * Both parties get notified.
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
      .select("id, catering_balance_days_before")
      .eq("member_id", user.id)
      .single();
    if (!creator) return apiError("Creator profile not found.", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select("id, creator_id, member_id, status, event_date")
      .eq("id", id)
      .single();
    if (!booking) return apiError("Booking not found.", 404);

    if (booking.creator_id !== creator.id) {
      return apiError("This booking isn't yours to accept.", 403);
    }
    if (booking.status !== "pending_acceptance") {
      return apiError(
        `Booking is in '${booking.status}', can't accept.`,
        409
      );
    }

    // Compute balance-charge schedule. Default 3 days before event,
    // configurable per creator (creators.catering_balance_days_before).
    // Time is set to 9am local — early enough to retry if the card
    // fails, late enough not to spam the customer at sunrise.
    const daysBefore = Math.max(
      1,
      Math.min(30, creator.catering_balance_days_before ?? 3)
    );
    const eventMs = new Date(booking.event_date + "T00:00:00").getTime();
    const chargeAt = new Date(eventMs - daysBefore * 24 * 60 * 60 * 1000);
    chargeAt.setHours(9, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("catering_bookings")
      .update({
        status: "confirmed",
        balance_charge_scheduled_for: chargeAt.toISOString(),
        accept_deadline: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[bookings.accept] update failed:", updateErr.message);
      return apiError("Failed to accept booking.", 500);
    }

    // Mirror into the chat thread (creator → customer).
    try {
      const { insertCateringThreadMessage } = await import(
        "@/lib/catering/insert-thread-message"
      );
      const eventDateLabel = new Date(
        booking.event_date + "T00:00:00"
      ).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const chargeLabel = chargeAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      await insertCateringThreadMessage({
        supabase,
        senderId: user.id, // creator's auth id
        recipientId: booking.member_id,
        body: `✅ Booking confirmed for ${eventDateLabel}. Your balance will be auto-charged on ${chargeLabel}.`,
      });
    } catch (err) {
      console.error("[bookings.accept] thread message failed:", err);
    }

    // Notify both parties (fire-and-forget).
    (async () => {
      try {
        const { notifyCateringBookingConfirmed } = await import(
          "@/lib/notifications"
        );
        await notifyCateringBookingConfirmed({
          bookingId: id,
          balanceChargeDate: chargeAt.toISOString(),
        });
      } catch (err) {
        console.error("[bookings.accept] notify threw:", err);
      }
    })();

    return apiSuccess({ booking_id: id, balance_charge_scheduled_for: chargeAt });
  } catch {
    return apiError("Failed to accept booking.", 500);
  }
}
