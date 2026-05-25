import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Insert a system-style message into the conversation between two
 * members. Used by catering inquiry/quote/booking events so the chat
 * thread mirrors the email thread.
 *
 * Why this lives in lib/ and not inlined into the routes: routes get
 * called from different auth contexts (cookie-bound supabase from the
 * inquiry/quote/accept routes, service-role supabase from the webhook).
 * Same helper handles both — pass whichever client the caller has.
 *
 * - `body` should include any URL inline (e.g., catering quote link).
 *   The existing chat UI renders URLs as clickable text already.
 * - `order_id` stays null — catering events don't tie to the orders
 *   table; catering uses its own bookings table.
 * - Best-effort: failures are logged but never propagated, so a slow
 *   Supabase insert can't block the email send or the API response.
 */
export async function insertCateringThreadMessage(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  senderId: string;
  recipientId: string;
  body: string;
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (args.supabase as any).from("messages").insert({
      sender_id: args.senderId,
      recipient_id: args.recipientId,
      body: args.body,
      order_id: null,
    });
    if (error) {
      console.error("[catering thread msg] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[catering thread msg] threw:", err);
  }
}
