import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/messages/mark-read
 *
 * Marks all unread messages from `partner_id` to the authenticated user as
 * read. Scopes to a specific order thread when `order_id` is provided; when
 * null, operates on the general (non-order) thread.
 *
 * Relies on the `"Recipient can mark read"` RLS policy on `messages` — no
 * schema change needed. Supabase Realtime UPDATE events on this table will
 * propagate the resulting `read_at` changes to the sender's subscribed UI.
 */
export async function POST(request: NextRequest) {
  try {
    const { partner_id, order_id } = await request.json();

    if (!partner_id || typeof partner_id !== "string") {
      return apiError("partner_id is required.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized. Please sign in.", 401);
    }

    // Build update scoped to this user as recipient and the given partner as sender.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("messages") as any)
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .eq("sender_id", partner_id)
      .is("read_at", null);

    // Scope to a specific order thread, or to the general (order_id IS NULL) thread.
    query = order_id ? query.eq("order_id", order_id) : query.is("order_id", null);

    const { data, error } = await query.select("id");

    if (error) {
      return apiError("Failed to mark messages as read.", 500);
    }

    return apiSuccess({ updated: Array.isArray(data) ? data.length : 0 });
  } catch {
    return apiError("Failed to mark messages as read.", 500);
  }
}
