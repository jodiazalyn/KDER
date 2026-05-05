import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { rowToOrder } from "@/lib/orders-server";
import { notifyOrderReminder } from "@/lib/notifications";

/**
 * POST /api/v1/cron/order-reminders — escalate creator notifications
 * for pending orders.
 *
 * Triggered every 5 minutes by Supabase pg_cron + pg_net (see
 * supabase/migrations/006_order_reminder_cron.sql). Authenticates
 * via a shared `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Reminder cadence (cumulative since order creation):
 *   reminder_count = 0  AND  age >= 15 min  → fire #1
 *   reminder_count = 1  AND  age >= 1 hr    → fire #2
 *   reminder_count = 2  AND  age >= 4 hr    → fire #3
 *   reminder_count = 3  AND  age >= 24 hr   → fire #4
 *   reminder_count = 4                       → stop
 *
 * Replaces the old auto-decline behavior — orders never auto-close;
 * they wait for the creator to explicitly accept or decline.
 */

const REMINDER_THRESHOLDS_SEC = [
  15 * 60,        // 15 min  → reminder #1
  60 * 60,        // 1 hr    → reminder #2
  4 * 60 * 60,    // 4 hr    → reminder #3
  24 * 60 * 60,   // 24 hr   → reminder #4
] as const;

const MAX_REMINDERS = REMINDER_THRESHOLDS_SEC.length;

interface PendingOrderRow {
  id: string;
  reminder_count: number;
  created_at: string;
  // Joined for the reminder template + recipient lookup
  creator: {
    id: string;
    member: { display_name: string | null; email: string | null };
  } | null;
  member: { display_name: string | null; email: string | null } | null;
  customer_email: string | null;
}

async function handle(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/order-reminders] CRON_SECRET not configured");
    return apiError("Cron not configured.", 500);
  }
  const provided = request.headers.get("authorization") ?? "";
  if (provided !== `Bearer ${expected}`) {
    return apiError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return apiError("Service client unavailable.", 500);
  }

  // ── Sweep ─────────────────────────────────────────────────────
  // Pull all pending orders whose reminder_count < MAX_REMINDERS, then
  // filter by age client-side. The volume is small (pending orders only,
  // RLS off) so a single broad query is simpler than 4 narrow queries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from("orders")
    .select(
      // Joined to creators + members for recipient details and template copy.
      // `creator:creators(...)` resolves to the creator row; the nested
      // `member:members(...)` resolves the creator's owning member (display
      // name + email). `member:members(...)` at the top level resolves the
      // *customer* member by `member_id`.
      `id, reminder_count, created_at, customer_email, listing_id, member_id, creator_id, quantity, fulfillment_type, status, total_amount, platform_fee, creator_payout, notes, terms_accepted_at, auto_decline_at, updated_at, last_reminder_at, member_phone, member_name, items, listing:listings(name, photos), creator:creators(id, member:members(display_name, email, handle)), member:members(display_name, email)`
    )
    .eq("status", "pending")
    .lt("reminder_count", MAX_REMINDERS);

  if (error) {
    console.error("[cron/order-reminders] query failed:", error.message);
    return apiError("Reminder query failed.", 500);
  }

  const now = Date.now();
  const sentByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const failures: string[] = [];

  for (const raw of (rows ?? []) as PendingOrderRow[]) {
    const ageSec = (now - new Date(raw.created_at).getTime()) / 1000;
    const next = raw.reminder_count + 1; // 1..4
    const threshold = REMINDER_THRESHOLDS_SEC[raw.reminder_count];
    if (ageSec < threshold) continue;

    const creatorMember = raw.creator?.member;
    const customerMember = raw.member;
    if (!creatorMember || !customerMember) {
      console.error(`[cron/order-reminders] order ${raw.id} missing creator/member join`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = rowToOrder(raw as any);
    try {
      await notifyOrderReminder(
        order,
        {
          display_name: creatorMember.display_name ?? "your creator",
          handle: (raw.creator?.member as { handle?: string } | undefined)?.handle ?? "",
          email: creatorMember.email,
        },
        {
          display_name: customerMember.display_name ?? "Customer",
          email: raw.customer_email ?? customerMember.email,
        },
        next as 1 | 2 | 3 | 4
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("orders")
        .update({
          reminder_count: next,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", raw.id);

      if (updateErr) {
        // Email already sent — log but don't retry (would re-send next sweep).
        // Consequence: same reminder may fire again in 5 min if the row didn't
        // get updated. Acceptable; investigate logs if it happens.
        console.error(`[cron/order-reminders] update failed for ${raw.id}:`, updateErr.message);
        failures.push(raw.id);
      } else {
        sentByLevel[next] += 1;
      }
    } catch (err) {
      console.error(`[cron/order-reminders] reminder ${next} threw for ${raw.id}:`, err);
      failures.push(raw.id);
    }
  }

  return apiSuccess({
    scanned: rows?.length ?? 0,
    sent: sentByLevel,
    failed: failures.length,
  });
}

export const GET = handle;
export const POST = handle;
