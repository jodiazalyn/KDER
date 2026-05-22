/**
 * Shared helper for the order-status-change routes (accept / ready /
 * complete / decline) and the Stripe webhook to load the joined data
 * needed by `notifications.ts`. Lives in its own file so it doesn't
 * pull `@/lib/notifications` into the call site of every route — keeps
 * the route files focused on their own logic.
 */

import { rowToOrder } from "./orders-server";
import type { Order } from "@/types";

interface NotificationContext {
  order: Order;
  creator: { display_name: string; handle: string; email: string | null };
  member: { display_name: string; email: string | null };
}

/**
 * Load an order plus the creator + customer details needed for
 * notification. Returns `null` when joins are missing or the row is
 * gone — callers should treat that as "skip notification, but don't
 * fail the underlying mutation."
 *
 * Accepts a Supabase client (browser or server) so route handlers can
 * pass their existing client without a new one being constructed.
 */
export async function fetchOrderForNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: string
): Promise<NotificationContext | null> {
  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `id, listing_id, member_id, creator_id, quantity, fulfillment_type, status, total_amount, platform_fee, creator_payout, notes, terms_accepted_at, auto_decline_at, created_at, updated_at, reminder_count, last_reminder_at, member_phone, member_name, customer_email, items, listing:listings(name, photos), creator:creators(member:members(display_name, email, handle)), member:members(display_name, email)`
    )
    .eq("id", orderId)
    .single();

  if (error || !row) {
    if (error) {
      console.error(
        `[notifications-fetch] order ${orderId} load failed:`,
        error.message
      );
    }
    return null;
  }

  const creatorMember = row.creator?.member;
  const customerMember = row.member;
  if (!creatorMember || !customerMember) {
    console.error(
      `[notifications-fetch] order ${orderId} missing creator/member join — skipping notification`
    );
    return null;
  }

  return {
    order: rowToOrder(row),
    creator: {
      display_name: creatorMember.display_name ?? "your creator",
      handle: creatorMember.handle ?? "",
      email: creatorMember.email ?? null,
    },
    member: {
      display_name: customerMember.display_name ?? "Customer",
      email: row.customer_email ?? customerMember.email ?? null,
    },
  };
}
