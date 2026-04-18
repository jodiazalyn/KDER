import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isValidTransition } from "@/lib/order-state-machine";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    // Fetch order and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("status, creator_id")
      .eq("id", id)
      .single();

    if (!order) return apiError("Order not found", 404);

    if (!isValidTransition(order.status, "declined")) {
      return apiError(`Cannot decline order in ${order.status} status`, 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return apiError("Failed to decline order", 500);

    return apiSuccess({ order_id: id, status: "declined" });
  } catch {
    return apiError("Failed to decline order", 500);
  }
}
