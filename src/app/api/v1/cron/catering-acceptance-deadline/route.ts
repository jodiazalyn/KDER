import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { cancelAndRefundBooking } from "@/lib/catering/cancel-booking";

/**
 * POST /api/v1/cron/catering-acceptance-deadline
 *
 * Sweeps `catering_bookings` for any in `pending_acceptance` whose
 * `accept_deadline` is in the past. Auto-declines them + refunds the
 * deposit (matches creator-initiated decline semantics).
 *
 * Schedule (per the plan): every 15 minutes via pg_cron + pg_net.
 * pg_cron migration ships in PR 4 alongside the balance-charge cron.
 *
 * Authentication: shared `Authorization: Bearer ${CRON_SECRET}` header,
 * matches existing cron routes (order-reminders, etc.).
 */
async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/acceptance-deadline] CRON_SECRET not configured");
    return apiError("Cron not configured.", 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return apiError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  if (!supabase) return apiError("Service client unavailable.", 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings, error } = await (supabase as any)
    .from("catering_bookings")
    .select("id, deposit_payment_intent_id, quote_id, accept_deadline")
    .eq("status", "pending_acceptance")
    .lt("accept_deadline", new Date().toISOString());

  if (error) {
    console.error(
      "[cron/acceptance-deadline] query failed:",
      error.message
    );
    return apiError("Query failed.", 500);
  }

  const rows = (bookings ?? []) as Array<{
    id: string;
    deposit_payment_intent_id: string;
    quote_id: string;
    accept_deadline: string;
  }>;

  let cancelled = 0;
  const failed: string[] = [];

  for (const b of rows) {
    const ok = await cancelAndRefundBooking({
      bookingId: b.id,
      paymentIntentId: b.deposit_payment_intent_id,
      quoteId: b.quote_id,
      reason:
        "The creator didn't accept within 4 hours, so the booking was auto-declined.",
    });
    if (ok) cancelled++;
    else failed.push(b.id);
  }

  console.log(
    `[cron/acceptance-deadline] swept ${rows.length}, cancelled ${cancelled}, failed ${failed.length}`
  );

  return apiSuccess({
    scanned: rows.length,
    cancelled,
    failed: failed.length,
  });
}

export const GET = handle;
export const POST = handle;
