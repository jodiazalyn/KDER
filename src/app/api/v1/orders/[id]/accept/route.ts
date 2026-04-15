import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Read optional body for pickup address context
    let pickupAddress: string | null = null;
    let memberPhone: string | null = null;
    let creatorName: string | null = null;
    let fulfillmentType: string | null = null;

    try {
      const body = await request.json();
      pickupAddress = body.pickup_address || null;
      memberPhone = body.member_phone || null;
      creatorName = body.creator_name || null;
      fulfillmentType = body.fulfillment_type || null;
    } catch {
      // Body is optional — may be empty
    }

    // TODO: Update order status in Supabase
    // For now, return success

    // Send pickup address SMS to member if this is a pickup order
    if (
      fulfillmentType === "pickup" &&
      memberPhone &&
      pickupAddress &&
      isTwilioConfigured()
    ) {
      const message = `Your KDER order from ${creatorName || "your creator"} has been confirmed! 🎉\n\nPickup at: ${pickupAddress}\n\nOrder #${id.slice(0, 8)}`;

      try {
        await sendSms(memberPhone, message);
      } catch (smsErr) {
        console.error("Failed to send pickup SMS:", smsErr);
        // Don't fail the accept — SMS is best-effort
      }
    }

    return apiSuccess({ order_id: id, status: "accepted", sms_sent: !!memberPhone });
  } catch {
    return apiError("Failed to accept order", 500);
  }
}
