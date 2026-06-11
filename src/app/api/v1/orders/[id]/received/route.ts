import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { postToSlack } from "@/lib/slack";
import type { OrderStatus } from "@/types";

/**
 * PUT /api/v1/orders/[id]/received — the CUSTOMER closes the loop on
 * an order after the creator has fulfilled it.
 *
 * This is deliberately decoupled from payout. Payout fires when the
 * creator taps "complete" (see ../complete/route.ts). This endpoint is
 * the customer's receipt + dispute signal: "yes I got it" or "there
 * was a problem". Either way we stamp the order and ping the ops Slack
 * channel so a human can follow up on disputes.
 *
 * Body: { status: "received" | "problem", note?: string }
 *
 * Auth: caller must be the order's customer (orders.member_id). The
 * creator cannot confirm receipt on the customer's behalf.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as {
      status?: string;
      note?: string;
    } | null;

    const status = body?.status;
    if (status !== "received" && status !== "problem") {
      return apiError("status must be 'received' or 'problem'.", 400);
    }
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : null;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Fetch the order + context for the Slack ping. RLS allows the
    // order's member to SELECT it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select(
        // `member_name` is denormalized onto the orders row at
        // checkout, so we read it directly instead of joining members
        // (which would collide with the nested creator→members embed).
        "id, member_id, creator_id, status, total_amount, fulfillment_type, received_confirmed_at, member_name, listing:listings(name), creator:creators!inner(member:members!inner(display_name))"
      )
      .eq("id", id)
      .maybeSingle() as {
        data:
          | {
              id: string;
              member_id: string;
              creator_id: string;
              status: OrderStatus;
              total_amount: number;
              fulfillment_type: string;
              received_confirmed_at: string | null;
              member_name: string | null;
              listing: { name: string | null } | null;
              creator: { member: { display_name: string | null } | null } | null;
            }
          | null;
      };

    if (!order) return apiError("Order not found.", 404);

    // Only the customer can confirm receipt. 404 (not 403) to avoid
    // leaking existence to a non-owner.
    if (order.member_id !== user.id) {
      return apiError("Order not found.", 404);
    }

    // Receipt only makes sense once the creator has fulfilled the
    // order (ready or completed). Reject pending/accepted/declined/etc.
    if (order.status !== "ready" && order.status !== "completed") {
      return apiError(
        `Cannot confirm receipt while the order is ${order.status}.`,
        400
      );
    }

    const confirmedAt = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("orders")
      .update({
        receipt_status: status,
        receipt_note: note,
        received_confirmed_at: confirmedAt,
        updated_at: confirmedAt,
      })
      .eq("id", id);

    if (error) {
      console.error("[orders/received] update failed:", error.message);
      return apiError("Failed to confirm receipt.", 500);
    }

    // Best-effort ops Slack ping. Disputes (status=problem) are the
    // important case — but we post both so the team has a full receipt
    // trail. Never block the response on Slack.
    const creatorName =
      order.creator?.member?.display_name ?? "Unknown creator";
    const customerName = order.member_name ?? "Customer";
    const listingName = order.listing?.name ?? "an order";
    const shortId = order.id.slice(0, 8);
    const isProblem = status === "problem";
    const headline = isProblem
      ? `🚨 *Order dispute reported* — #${shortId}`
      : `✅ *Order receipt confirmed* — #${shortId}`;
    const lines = [
      headline,
      `Item: ${listingName} ($${Number(order.total_amount).toFixed(2)} · ${order.fulfillment_type})`,
      `Creator: ${creatorName}`,
      `Customer: ${customerName}`,
    ];
    if (isProblem) {
      lines.push(`Problem: ${note ? note : "(no detail provided)"}`);
    }
    // Fire-and-forget — do not await/block the customer's response.
    void postToSlack({ text: lines.join("\n") });

    return apiSuccess({
      order_id: id,
      receipt_status: status,
      received_confirmed_at: confirmedAt,
    });
  } catch (err) {
    console.error("[orders/received] error:", err);
    return apiError("Failed to confirm receipt.", 500);
  }
}
