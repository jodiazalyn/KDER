import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { rowToOrder } from "@/lib/orders-server";
import { notifyOrderReminder } from "@/lib/notifications";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";

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
 *   reminder_count = 1  AND  age >= 30 min  → fire #2
 *   reminder_count = 2  AND  age >= 45 min  → fire #3
 *   reminder_count = 3  AND  age >= 60 min  → fire #4
 *   reminder_count = 4  AND  age >= 90 min  → fire #5
 *   reminder_count = 5  AND  age >= 120 min → fire #6 (final)
 *   reminder_count = 6                       → stop
 *
 * Each reminder fires both an email and an SMS to the creator so
 * they can respond quickly regardless of which channel they check.
 */

const REMINDER_THRESHOLDS_SEC = [
  15 * 60,   //  15 min → reminder #1
  30 * 60,   //  30 min → reminder #2
  45 * 60,   //  45 min → reminder #3
  60 * 60,   //  60 min → reminder #4
  90 * 60,   //  90 min → reminder #5
  120 * 60,  // 120 min → reminder #6 (final)
] as const;

type ReminderNumber = 1 | 2 | 3 | 4 | 5 | 6;

const MAX_REMINDERS = REMINDER_THRESHOLDS_SEC.length;

// Human-readable age labels used in the SMS body.
const SMS_AGE_LABEL: Record<ReminderNumber, string> = {
  1: "15 min",
  2: "30 min",
  3: "45 min",
  4: "1 hour",
  5: "90 min",
  6: "2 hours",
};

interface PendingOrderRow {
  id: string;
  reminder_count: number;
  created_at: string;
  customer_email: string | null;
  creator: {
    id: string;
    member: {
      display_name: string | null;
      email: string | null;
      handle: string | null;
      phone: string | null;
    };
  } | null;
  member: { display_name: string | null; email: string | null } | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from("orders")
    .select(
      `id, reminder_count, created_at, customer_email,
       listing_id, member_id, creator_id, quantity, fulfillment_type,
       status, total_amount, platform_fee, creator_payout, notes,
       terms_accepted_at, auto_decline_at, updated_at, last_reminder_at,
       member_phone, member_name, items,
       listing:listings(name, photos),
       creator:creators(id, member:members(display_name, email, handle, phone)),
       member:members(display_name, email)`
    )
    .eq("status", "pending")
    // Only remind on orders Stripe has confirmed paid. Checkout inserts
    // the row as pending + paid_at NULL before payment; without this gate
    // the sweep would nag creators about unpaid / abandoned phantom orders.
    .not("paid_at", "is", null)
    .lt("reminder_count", MAX_REMINDERS);

  if (error) {
    console.error("[cron/order-reminders] query failed:", error.message);
    return apiError("Reminder query failed.", 500);
  }

  const now = Date.now();
  const sentByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const failures: string[] = [];
  const twilioOn = isTwilioConfigured();

  for (const raw of (rows ?? []) as PendingOrderRow[]) {
    const ageSec = (now - new Date(raw.created_at).getTime()) / 1000;
    const next = (raw.reminder_count + 1) as ReminderNumber;
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
    const creatorCtx = {
      display_name: creatorMember.display_name ?? "Chef",
      handle: creatorMember.handle ?? "",
      email: creatorMember.email,
    };
    const memberCtx = {
      display_name: customerMember.display_name ?? "Customer",
      email: raw.customer_email ?? customerMember.email,
    };

    try {
      // Email reminder (threaded to the original order-placed email).
      await notifyOrderReminder(order, creatorCtx, memberCtx, next);

      // SMS reminder — same urgency, brief copy for the lock screen.
      if (twilioOn && creatorMember.phone) {
        const ageLabel = SMS_AGE_LABEL[next];
        const isFinal = next === MAX_REMINDERS;
        const smsBody = isFinal
          ? `KDER final reminder: ${memberCtx.display_name}'s order has been waiting ${ageLabel}. Please accept or decline now.`
          : `KDER: ${memberCtx.display_name} ordered ${order.listing_name} ${ageLabel} ago. Still pending — open your dashboard to respond.`;
        await sendSms(creatorMember.phone, smsBody).catch((err) =>
          console.error(`[cron/order-reminders] SMS #${next} failed for ${raw.id}:`, err)
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("orders")
        .update({
          reminder_count: next,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", raw.id);

      if (updateErr) {
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
