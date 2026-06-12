import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import type { OrderStatus } from "@/types";

/**
 * POST /api/v1/orders/[id]/review — the CUSTOMER leaves a star review
 * after confirming receipt.
 *
 * Stars (1-5) required; written body optional; the step is skippable
 * (the client simply doesn't call this endpoint on skip). One review
 * per order — a resubmit upserts on the order_id unique constraint.
 *
 * After inserting, we recompute the creator's denormalized rating
 * aggregate (review_rating_avg + review_count) in the same request so
 * the storefront header reflects the new review immediately. The
 * aggregate read + creators update run through the service-role client
 * (the route is the integrity layer); the order-ownership check below
 * is the authorization gate.
 *
 * Body: { rating: 1..5, body?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payload = (await request.json().catch(() => null)) as {
      rating?: number;
      body?: string;
    } | null;

    const rating = payload?.rating;
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return apiError("rating must be an integer between 1 and 5.", 400);
    }
    const reviewBody =
      typeof payload?.body === "string" && payload.body.trim()
        ? payload.body.trim().slice(0, 2000)
        : null;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Authorize against the order: caller must be its customer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("id, member_id, creator_id, status")
      .eq("id", id)
      .maybeSingle() as {
        data:
          | {
              id: string;
              member_id: string;
              creator_id: string;
              status: OrderStatus;
            }
          | null;
      };

    if (!order) return apiError("Order not found.", 404);
    if (order.member_id !== user.id) {
      return apiError("Order not found.", 404);
    }
    if (order.status !== "ready" && order.status !== "completed") {
      return apiError(
        `Cannot review an order that is ${order.status}.`,
        400
      );
    }

    // Use the service client for the write + aggregate recompute. Fall
    // back to the user session client if the service key isn't set
    // (the insert policy allows member_id = auth.uid()).
    const service = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writer: any = service ?? supabase;

    const { error: insertErr } = await writer
      .from("order_reviews")
      .upsert(
        {
          order_id: id,
          creator_id: order.creator_id,
          member_id: order.member_id,
          rating,
          body: reviewBody,
        },
        { onConflict: "order_id" }
      );

    if (insertErr) {
      console.error("[orders/review] insert failed:", insertErr.message);
      return apiError("Failed to save review.", 500);
    }

    // Recompute the creator's aggregate from the source of truth.
    const { data: rows } = await writer
      .from("order_reviews")
      .select("rating")
      .eq("creator_id", order.creator_id) as {
        data: { rating: number }[] | null;
      };

    if (rows && rows.length > 0) {
      const count = rows.length;
      const avg =
        Math.round(
          (rows.reduce((sum, r) => sum + r.rating, 0) / count) * 100
        ) / 100;
      const { error: aggErr } = await writer
        .from("creators")
        .update({ review_rating_avg: avg, review_count: count })
        .eq("id", order.creator_id);
      if (aggErr) {
        // The review is saved; a stale aggregate is non-fatal.
        console.warn(
          "[orders/review] aggregate update failed:",
          aggErr.message
        );
      }
    }

    return apiSuccess({ order_id: id, rating });
  } catch (err) {
    console.error("[orders/review] error:", err);
    return apiError("Failed to save review.", 500);
  }
}
