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
    // Payment gate: only surface orders Stripe has actually confirmed
    // paid. Checkout inserts the row as `status=pending, paid_at=NULL`
    // BEFORE redirecting to Stripe, and the webhook stamps `paid_at`
    // only on `checkout.session.completed`. Without this filter an
    // in-progress or abandoned (never-paid) order shows in the creator's
    // inbox as a real order to fulfill. `paid_at IS NOT NULL` matches
    // exactly when the order-placed email fires.
    .not("paid_at", "is", null)
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
