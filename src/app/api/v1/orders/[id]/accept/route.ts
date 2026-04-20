import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isValidTransition } from "@/lib/order-state-machine";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";
import type { OrderStatus } from "@/types";

/**
 * PUT /api/v1/orders/[id]/accept — creator accepts a pending order.
 *
 * Full Supabase implementation (previously a stub). Flow:
 *   1. Auth — 401 if no session.
 *   2. Resolve caller's creator row + pickup address + display name for SMS.
 *   3. Fetch the order, verify caller owns it (creator_id match).
 *   4. Validate the state transition via the shared state machine.
 *   5. Update status to "accepted".
 *   6. Best-effort Twilio SMS to the member with the pickup address.
 *
 * The SMS is intentionally best-effort: a Twilio failure does not roll back
 * the status change. We log and continue. Failing to send an SMS should not
 * block the creator from accepting an order.
 */
export async function PUT(
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

    // Resolve caller's creator row along with the data we need for SMS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id, pickup_address, member:members!inner(display_name)")
      .eq("member_id", user.id)
      .single() as {
        data: {
          id: string;
          pickup_address: string | null;
          member: { display_name: string | null } | null;
        } | null;
      };

    if (!creator) return apiError("Creator profile not found.", 404);

    // Fetch the order and verify the caller owns it. We look up by id only so
    // we can differentiate 404 (row doesn't exist) from 403 (wrong owner) —
    // though we return 404 in both cases to avoid leaking order existence.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("status, creator_id, fulfillment_type, member_phone")
      .eq("id", id)
      .maybeSingle() as {
        data: {
          status: OrderStatus;
          creator_id: string;
          fulfillment_type: string;
          member_phone: string | null;
        } | null;
      };

    if (!order) return apiError("Order not found.", 404);
    if (order.creator_id !== creator.id) {
      return apiError("Order not found.", 404);
    }

    if (!isValidTransition(order.status, "accepted")) {
      return apiError(
        `Cannot accept order in ${order.status} status.`,
        400
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("orders")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      console.error("[orders/accept] update failed:", updateErr.message);
      return apiError("Failed to accept order.", 500);
    }

    // Best-effort pickup SMS.
    let smsSent = false;
    if (
      order.fulfillment_type === "pickup" &&
      order.member_phone &&
      creator.pickup_address &&
      isTwilioConfigured()
    ) {
      const creatorName = creator.member?.display_name ?? "your creator";
      const message = `Your KDER order from ${creatorName} has been confirmed! 🎉\n\nPickup at: ${creator.pickup_address}\n\nOrder #${id.slice(0, 8)}`;
      try {
        await sendSms(order.member_phone, message);
        smsSent = true;
      } catch (smsErr) {
        console.error("[orders/accept] SMS failed:", smsErr);
        // Intentionally do not fail the accept — SMS is best-effort.
      }
    }

    return apiSuccess({ order_id: id, status: "accepted", sms_sent: smsSent });
  } catch (err) {
    console.error("[orders/accept] error:", err);
    return apiError("Failed to accept order.", 500);
  }
}
