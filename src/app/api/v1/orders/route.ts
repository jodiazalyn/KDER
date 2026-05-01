import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { rowToOrder } from "@/lib/orders-server";
import type { Order } from "@/types";

const ACTIVE_STATUSES = ["pending", "accepted", "ready"] as const;

/**
 * GET /api/v1/orders — list the authenticated creator's orders.
 *
 * Query params:
 *   - status: "active" | "completed" | "declined" (optional)
 *       "active" maps to status IN (pending, accepted, ready)
 *       omitted returns all statuses (used for tab count calculation)
 *
 * Returns up to 100 rows, newest first. Pagination is intentionally deferred
 * until any creator exceeds that; see plan doc for rationale.
 */
export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get("status");

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Resolve the caller's creator row. Non-creators get an empty list rather
    // than a 404 so the page renders cleanly (empty state).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single() as { data: { id: string } | null };

    if (!creator) return apiSuccess({ orders: [] });

    // ── Lazy auto-decline ─────────────────────────────────────────
    // Pending orders past their auto_decline_at deadline are stuck —
    // creator never accepted, customer never abandoned formally, and
    // they linger in the Active tab cluttering the list. Sweep them
    // here on every list fetch, scoped to this creator only.
    //
    // No refund is issued: pending state means the customer never
    // completed Stripe Checkout (the checkout.session.completed webhook
    // would have moved the order to 'accepted'). So there's no captured
    // payment to refund — only an abandoned order to clean up.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("orders")
      .update({
        status: "declined",
        updated_at: new Date().toISOString(),
      })
      .eq("creator_id", creator.id)
      .eq("status", "pending")
      .lt("auto_decline_at", new Date().toISOString());

    // Single query, LEFT JOIN listings for the photo + name fallback. Using the
    // Supabase foreign-key relation syntax; `listing` here is an alias for the
    // related row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("orders")
      .select("*, listing:listings(name, photos)")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusParam === "active") {
      query = query.in("status", ACTIVE_STATUSES);
    } else if (statusParam === "completed") {
      query = query.eq("status", "completed");
    } else if (statusParam === "declined") {
      query = query.eq("status", "declined");
    }
    // No filter → return all statuses so the client can compute tab counts.

    const { data: rows, error } = await query;
    if (error) {
      console.error("[orders] list query failed:", error.message);
      return apiError("Failed to load orders.", 500);
    }

    const orders: Order[] = Array.isArray(rows) ? rows.map(rowToOrder) : [];
    return apiSuccess({ orders });
  } catch (err) {
    console.error("[orders] list error:", err);
    return apiError("Failed to load orders.", 500);
  }
}

/**
 * POST /api/v1/orders — legacy stub.
 *
 * Order creation flows through /api/v1/checkout, which inserts into Supabase
 * before redirecting to Stripe. This endpoint exists only because the demo
 * app had it; it's kept as a 410 so any stray caller fails loudly instead of
 * silently "succeeding" with an empty order id.
 */
export async function POST() {
  return apiError(
    "Orders are created via /api/v1/checkout. This endpoint is deprecated.",
    410
  );
}
