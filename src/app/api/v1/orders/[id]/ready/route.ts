import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isValidTransition } from "@/lib/order-state-machine";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";
import type { OrderStatus } from "@/types";

/**
 * PUT /api/v1/orders/[id]/ready — creator marks an accepted order as ready
 * for pickup (or out for delivery).
 *
 * Fires a best-effort Twilio SMS to the customer so they know to come get it
 * (or expect the delivery). Mirrors the accept route's SMS pattern — a Twilio
 * failure does NOT roll back the state change.
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
    if (!user) return apiError("Unauthorized", 401);

    // Resolve caller's creator row + pickup_address + display name so we can
    // build the customer SMS if the transition succeeds.
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
      // 404 instead of 403 — don't leak existence.
      return apiError("Order not found.", 404);
    }

    if (!isValidTransition(order.status, "ready")) {
      return apiError(
        `Cannot mark order as ready in ${order.status} status`,
        400
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[orders/ready] update failed:", error.message);
      return apiError("Failed to mark order ready", 500);
    }

    // Best-effort customer SMS — log and continue on Twilio failure.
    let smsSent = false;
    if (order.member_phone && isTwilioConfigured()) {
      const creatorName = creator.member?.display_name ?? "your creator";
      const locationLine =
        order.fulfillment_type === "pickup"
          ? creator.pickup_address
            ? `Pickup at: ${creator.pickup_address}`
            : "Creator will share pickup details."
          : "Out for delivery.";
      const message = `Your KDER order from ${creatorName} is ready! 🍽️\n\n${locationLine}\n\nOrder #${id.slice(0, 8)}`;
      try {
        await sendSms(order.member_phone, message);
        smsSent = true;
      } catch (smsErr) {
        console.error("[orders/ready] SMS failed:", smsErr);
        // Intentionally do not fail the ready transition — SMS is best-effort.
      }
    }

    return apiSuccess({ order_id: id, status: "ready", sms_sent: smsSent });
  } catch (err) {
    console.error("[orders/ready] error:", err);
    return apiError("Failed to mark order ready", 500);
  }
}
