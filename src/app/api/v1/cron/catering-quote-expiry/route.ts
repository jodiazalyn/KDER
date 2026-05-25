import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/cron/catering-quote-expiry
 *
 * Sweeps `catering_quotes` for any in 'sent' status with expires_at
 * in the past, flips them to 'expired', and emails the customer to
 * let them know their window closed.
 *
 * Schedule: hourly (migration 014). Lightweight — most hours have
 * zero rows to process.
 */
async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/quote-expiry] CRON_SECRET not configured");
    return apiError("Cron not configured.", 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return apiError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  if (!supabase) return apiError("Service client unavailable.", 500);

  // Find expired sent quotes. Service-role client bypasses RLS so this
  // sees all rows across creators.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from("catering_quotes")
    .select("id, inquiry_id, member_id, total_cents, expires_at")
    .eq("status", "sent")
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[cron/quote-expiry] query failed:", error.message);
    return apiError("Query failed.", 500);
  }

  const quotes = (rows ?? []) as Array<{
    id: string;
    inquiry_id: string;
    member_id: string;
    total_cents: number;
    expires_at: string;
  }>;

  let expired = 0;
  for (const q of quotes) {
    // Mark expired. Even on partial failure we want to update what we
    // can — log + continue rather than bail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("catering_quotes")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", q.id);

    if (updateErr) {
      console.error("[cron/quote-expiry] update failed:", q.id, updateErr.message);
      continue;
    }
    expired++;

    // Notify the customer (best-effort, doesn't block the next row).
    try {
      const { notifyCateringQuoteExpired } = await import("@/lib/notifications");
      await notifyCateringQuoteExpired({ quoteId: q.id });
    } catch (err) {
      console.error("[cron/quote-expiry] notify threw:", err);
    }
  }

  console.log(
    `[cron/quote-expiry] swept ${quotes.length}, expired ${expired}`
  );

  return apiSuccess({ scanned: quotes.length, expired });
}

export const GET = handle;
export const POST = handle;
