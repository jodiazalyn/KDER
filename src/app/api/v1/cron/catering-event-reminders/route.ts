import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/cron/catering-event-reminders
 *
 * Daily sweep. For each confirmed/balance_paid booking with an
 * upcoming event_date, decides which of three reminders are due:
 *
 *   3 days out  → creator prep + customer "your event is in 3 days"
 *   1 day out   → both parties "tomorrow"
 *   morning of  → both parties "today is the day"
 *
 * Each booking has a `reminders_sent` JSONB column tracking which
 * tiers have fired ({"3d": true, "1d": true, "morning_of": true}).
 * The route is safe to run multiple times — already-sent reminders
 * are skipped.
 *
 * Schedule: daily at 14:00 UTC (≈9am Central). Migration 014.
 */

type ReminderKey = "3d" | "1d" | "morning_of";

interface BookingRow {
  id: string;
  event_date: string; // YYYY-MM-DD
  status: string;
  reminders_sent: Partial<Record<ReminderKey, boolean>>;
}

async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/event-reminders] CRON_SECRET not configured");
    return apiError("Cron not configured.", 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return apiError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  if (!supabase) return apiError("Service client unavailable.", 500);

  // Pull bookings in the next 4 days (catches all three reminder
  // tiers + a small buffer). The index idx_catering_bookings_upcoming
  // makes this cheap.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from("catering_bookings")
    .select("id, event_date, status, reminders_sent")
    .in("status", ["confirmed", "balance_paid"])
    .gte("event_date", isoDate(today))
    .lte("event_date", isoDate(horizon));

  if (error) {
    console.error("[cron/event-reminders] query failed:", error.message);
    return apiError("Query failed.", 500);
  }

  const bookings = (rows ?? []) as BookingRow[];

  const sentCounts: Record<ReminderKey, number> = {
    "3d": 0,
    "1d": 0,
    morning_of: 0,
  };

  for (const b of bookings) {
    const daysOut = daysBetween(today, new Date(b.event_date + "T00:00:00Z"));
    const key = bucketFor(daysOut);
    if (!key) continue; // outside any reminder window
    if (b.reminders_sent?.[key]) continue; // already sent

    // Fire the notification. Each notify function handles both parties.
    try {
      const { notifyCateringEventReminder } = await import("@/lib/notifications");
      await notifyCateringEventReminder({
        bookingId: b.id,
        tier: key,
      });
    } catch (err) {
      console.error("[cron/event-reminders] notify threw:", err);
      continue;
    }

    // Persist the flag so re-runs today don't double-send.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("catering_bookings")
      .update({
        reminders_sent: { ...(b.reminders_sent ?? {}), [key]: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", b.id);

    sentCounts[key]++;
  }

  console.log(
    `[cron/event-reminders] scanned ${bookings.length}, sent ${JSON.stringify(sentCounts)}`
  );

  return apiSuccess({ scanned: bookings.length, sent: sentCounts });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole-day delta between two midnight-aligned dates. */
function daysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

/** Map the days-out value to one of our three reminder tiers, or
 *  null if the event is outside the reminder window. */
function bucketFor(daysOut: number): ReminderKey | null {
  if (daysOut === 0) return "morning_of";
  if (daysOut === 1) return "1d";
  if (daysOut === 3) return "3d";
  return null;
}

export const GET = handle;
export const POST = handle;
