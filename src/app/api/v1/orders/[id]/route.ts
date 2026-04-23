import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { rowToOrder } from "@/lib/orders-server";

/**
 * GET /api/v1/orders/[id] — fetch a single order.
 *
 * Authorized for EITHER party of the order:
 *   - The creator who fulfills it (caller's `creators.id` === `order.creator_id`)
 *   - The customer who placed it (caller's `auth.uid()` === `order.member_id`)
 *
 * Mismatches return 404 (same as unknown), which deliberately avoids leaking
 * whether the order exists under a different account. RLS on the `orders`
 * table provides defense in depth — this app-layer check is belt-and-suspenders.
 *
 * Response shape flattens the joined creator info so the UI can reach
 * `order.creator_member_id` (the creator's auth user id — used as
 * `recipient_id` when the customer messages them) and `order.creator_display_name`
 * without navigating a nested join object.
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

    // Resolve caller's creator row — may be null if the caller is a customer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .maybeSingle() as { data: { id: string } | null };

    // Fetch the order along with the creator's member_id, display_name, and
    // pickup_address so the customer-facing UI can render the creator's name,
    // show the pickup address on ready, and use member_id as recipient_id for
    // messaging. RLS allows SELECT if the caller is either the order's member
    // or the owning creator.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("orders")
      .select(
        "*, listing:listings(name, photos), creator:creators!inner(member_id, pickup_address, member:members!inner(display_name))"
      )
      .eq("id", id)
      .maybeSingle() as {
        data:
          | {
              id: string;
              member_id: string;
              creator_id: string;
              creator: {
                member_id: string;
                pickup_address: string | null;
                member: { display_name: string | null } | null;
              } | null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              [key: string]: any;
            }
          | null;
        error: { message: string } | null;
      };

    if (error) {
      console.error("[orders] detail query failed:", error.message);
      return apiError("Failed to load order.", 500);
    }

    if (!row) return apiError("Order not found.", 404);

    // Authorize: must be either the order's customer OR its creator.
    const isCustomer = row.member_id === user.id;
    const isCreator = creator !== null && row.creator_id === creator.id;
    if (!isCustomer && !isCreator) {
      // 404 instead of 403 — don't leak existence.
      return apiError("Order not found.", 404);
    }

    const order = {
      ...rowToOrder(row),
      creator_member_id: row.creator?.member_id ?? null,
      creator_display_name: row.creator?.member?.display_name ?? null,
      // Override pickup_address (null from rowToOrder) with the creator's
      // actual pickup address pulled from the join.
      pickup_address: row.creator?.pickup_address ?? null,
    };

    return apiSuccess({ order });
  } catch (err) {
    console.error("[orders] detail error:", err);
    return apiError("Failed to load order.", 500);
  }
}
