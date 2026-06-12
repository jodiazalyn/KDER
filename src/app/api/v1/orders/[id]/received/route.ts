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

    // Fetch the order + full context for the Slack ping. We pull every
    // field the ops team needs to action a dispute: line items, money
    // split, fulfillment + addresses, and BOTH parties' contact info.
    // Customer contact is denormalized onto the orders row at checkout
    // (member_name/member_phone/customer_email); creator contact comes
    // off the joined members row. RLS allows the order's member to
    // SELECT it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select(
        "id, member_id, creator_id, status, quantity, fulfillment_type, total_amount, platform_fee, creator_payout, notes, items, created_at, received_confirmed_at, member_name, member_phone, customer_email, delivery_address, dropoff_address, dropoff_instructions, listing:listings(name), creator:creators!inner(pickup_address, member:members!inner(display_name, handle, phone, email))"
      )
      .eq("id", id)
      .maybeSingle() as {
        data:
          | {
              id: string;
              member_id: string;
              creator_id: string;
              status: OrderStatus;
              quantity: number | null;
              fulfillment_type: string;
              total_amount: number;
              platform_fee: number | null;
              creator_payout: number | null;
              notes: string | null;
              items:
                | Array<{ name?: string; quantity?: number; price?: number }>
                | null;
              created_at: string | null;
              received_confirmed_at: string | null;
              member_name: string | null;
              member_phone: string | null;
              customer_email: string | null;
              delivery_address: string | null;
              dropoff_address: string | null;
              dropoff_instructions: string | null;
              listing: { name: string | null } | null;
              creator: {
                pickup_address: string | null;
                member: {
                  display_name: string | null;
                  handle: string | null;
                  phone: string | null;
                  email: string | null;
                } | null;
              } | null;
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
    void postToSlack({ text: buildSlackMessage(order, status, note) });

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

// ── Slack message builder ─────────────────────────────────────────
// Shape mirrors the select() above. Kept loose (nullable everything)
// so a missing join field degrades to an omitted line rather than a
// throw.
interface OrderForSlack {
  id: string;
  status: OrderStatus;
  quantity: number | null;
  fulfillment_type: string;
  total_amount: number;
  platform_fee: number | null;
  creator_payout: number | null;
  notes: string | null;
  items: Array<{ name?: string; quantity?: number; price?: number }> | null;
  created_at: string | null;
  member_name: string | null;
  member_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  dropoff_address: string | null;
  dropoff_instructions: string | null;
  listing: { name: string | null } | null;
  creator: {
    pickup_address: string | null;
    member: {
      display_name: string | null;
      handle: string | null;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
}

function money(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Build a readable, multi-section Slack message for an order receipt
 * confirmation / dispute. Lines with no value are omitted so the
 * message stays clean across pickup vs delivery and partial data.
 */
function buildSlackMessage(
  order: OrderForSlack,
  status: "received" | "problem",
  note: string | null
): string {
  const isProblem = status === "problem";
  const shortId = order.id.slice(0, 8);
  const sections: string[] = [];

  // Headline
  sections.push(
    isProblem
      ? `🚨 *Order dispute reported*  ·  #${shortId}`
      : `✅ *Order receipt confirmed*  ·  #${shortId}`
  );

  // Problem detail goes right under the headline so it's impossible to
  // miss when triaging.
  if (isProblem) {
    sections.push(`*Problem reported*\n> ${note ? note : "_(no detail provided)_"}`);
  }

  // Order details
  const orderLines: string[] = [];
  const items =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [{ name: order.listing?.name ?? "Item", quantity: order.quantity ?? 1 }];
  for (const it of items) {
    const name = it.name ?? "Item";
    const qty = it.quantity ?? 1;
    orderLines.push(`• ${name} ×${qty}`);
  }
  orderLines.push(
    `• Fulfillment: ${order.fulfillment_type}`,
    `• Total: ${money(order.total_amount)}  (platform fee ${money(order.platform_fee)} · creator payout ${money(order.creator_payout)})`,
    `• Placed: ${fmtDate(order.created_at)}`
  );
  // Address — delivery vs pickup.
  const deliveryAddr = order.delivery_address ?? order.dropoff_address;
  if (order.fulfillment_type === "pickup") {
    if (order.creator?.pickup_address) {
      orderLines.push(`• Pickup at: ${order.creator.pickup_address}`);
    }
  } else if (deliveryAddr) {
    orderLines.push(`• Deliver to: ${deliveryAddr}`);
    if (order.dropoff_instructions) {
      orderLines.push(`• Drop-off notes: ${order.dropoff_instructions}`);
    }
  }
  if (order.notes) orderLines.push(`• Order notes: ${order.notes}`);
  sections.push(`*Order*\n${orderLines.join("\n")}`);

  // Customer contact
  const custLines: string[] = [`• Name: ${order.member_name ?? "—"}`];
  if (order.member_phone) custLines.push(`• Phone: ${order.member_phone}`);
  if (order.customer_email) custLines.push(`• Email: ${order.customer_email}`);
  sections.push(`*Customer*\n${custLines.join("\n")}`);

  // Creator contact
  const cm = order.creator?.member;
  const creatorName = cm?.display_name ?? "Unknown creator";
  const creatorTitle = cm?.handle
    ? `${creatorName} (@${cm.handle})`
    : creatorName;
  const creatorLines: string[] = [`• Name: ${creatorTitle}`];
  if (cm?.phone) creatorLines.push(`• Phone: ${cm.phone}`);
  if (cm?.email) creatorLines.push(`• Email: ${cm.email}`);
  sections.push(`*Creator*\n${creatorLines.join("\n")}`);

  // Blank line between sections for readability.
  return sections.join("\n\n");
}
