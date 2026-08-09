import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToOrder } from "@/lib/orders-server";
import type { Order } from "@/types";

const ACTIVE_STATUSES = ["pending", "accepted", "ready"] as const;
type StatusFilter = "active" | "completed" | "declined" | null;

/**
 * Load orders for a creator. Single source of truth — used by
 * the /api/v1/orders GET route AND by the /orders Server
 * Component page. Result includes the linked listing's name +
 * photos so the row can render without a second query.
 *
 * Default: 100 most recent orders, all statuses. Pass
 * `statusFilter` to scope to active / completed / declined
 * (matches the inbox tabs).
 */
export async function loadCreatorOrders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creatorId: string,
  statusFilter: StatusFilter = null
): Promise<{ data: Order[]; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select("*, listing:listings(name, photos)")
    .eq("creator_id", creatorId)
    // Hide pre-payment phantom rows: checkout inserts an order at
    // status="pending", paid_at=NULL *before* the customer pays, so an
    // abandoned/mid-checkout order must never surface to the creator as
    // actionable. `paid_at` is only stamped by the Stripe
    // `checkout.session.completed` webhook (handleCheckoutCompleted), so it
    // is the reliable "actually paid" signal. We gate on payment ONLY for
    // pending rows — terminal history (completed/declined) and any
    // accepted/ready rows stay visible regardless of paid_at, so existing
    // order history is never hidden. Reads as: show the row if it is not
    // pending, OR it is paid.
    .or("status.neq.pending,paid_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (statusFilter === "completed") {
    query = query.eq("status", "completed");
  } else if (statusFilter === "declined") {
    query = query.eq("status", "declined");
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[loaders.orders] failed:", error.message);
    return { data: [], error: error.message };
  }
  const orders: Order[] = Array.isArray(rows) ? rows.map(rowToOrder) : [];
  return { data: orders, error: null };
}
