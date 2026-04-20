import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { rowToOrder } from "@/lib/orders-server";

/**
 * GET /api/v1/orders/[id] — fetch a single order scoped to the authenticated
 * creator. The `WHERE creator_id = :creatorId` in the query serves as the
 * ownership check: a mismatched id returns 404 (same as unknown), which
 * deliberately avoids leaking whether the order exists under a different
 * creator.
 */
export async function GET(
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
      .select("id")
      .eq("member_id", user.id)
      .single() as { data: { id: string } | null };

    if (!creator) return apiError("Creator profile not found.", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("orders")
      .select("*, listing:listings(name, photos)")
      .eq("id", id)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (error) {
      console.error("[orders] detail query failed:", error.message);
      return apiError("Failed to load order.", 500);
    }

    if (!row) return apiError("Order not found.", 404);

    return apiSuccess({ order: rowToOrder(row) });
  } catch (err) {
    console.error("[orders] detail error:", err);
    return apiError("Failed to load order.", 500);
  }
}
