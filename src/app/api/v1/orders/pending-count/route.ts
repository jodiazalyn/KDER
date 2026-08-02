import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/orders/pending-count — lightweight poll for the
 * new-order sticky banner shown across the creator app shell.
 *
 * Returns the count of PENDING orders (awaiting the creator's
 * accept/decline) plus the id of the most recent one so the banner
 * can deep-link straight into it. Non-creators / unauthenticated
 * callers get a benign zero so the banner simply never renders.
 *
 * Kept deliberately tiny (count + one id) — it's polled on every
 * app-shell page, so it must not pull full order rows.
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiSuccess({ count: 0, latest_order_id: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .maybeSingle() as { data: { id: string } | null };

    if (!creator) return apiSuccess({ count: 0, latest_order_id: null });

    // count: 'exact' + a small select of the newest pending id. We pull
    // just the single newest id (limit 1) for the deep link and read the
    // total from the count header.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, count, error } = await (supabase as any)
      .from("orders")
      .select("id", { count: "exact" })
      .eq("creator_id", creator.id)
      .eq("status", "pending")
      // Only count orders Stripe has confirmed paid. An unpaid pre-payment
      // row (checkout inserts pending + paid_at NULL before Stripe) must
      // not inflate the new-order banner. Mirrors loadCreatorOrders.
      .not("paid_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1) as {
        data: { id: string }[] | null;
        count: number | null;
        error: { message: string } | null;
      };

    if (error) {
      console.error("[orders/pending-count] query failed:", error.message);
      return apiError("Failed to load order count.", 500);
    }

    return apiSuccess({
      count: count ?? 0,
      latest_order_id: rows && rows.length > 0 ? rows[0].id : null,
    });
  } catch (err) {
    console.error("[orders/pending-count] error:", err);
    return apiError("Failed to load order count.", 500);
  }
}
