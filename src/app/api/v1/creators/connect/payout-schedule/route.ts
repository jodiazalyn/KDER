import { NextRequest } from "next/server";
import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * PATCH /api/v1/creators/connect/payout-schedule
 *
 * Body:
 *   {
 *     interval: 'daily' | 'weekly' | 'manual',
 *     weekly_anchor?: 'monday' | ... (required when interval='weekly')
 *   }
 *
 * Calls `accounts.update` with `settings.payouts.schedule`. Stripe
 * applies the new schedule on the next payout cycle — funds already
 * in transit are unaffected (we surface that in the sheet copy).
 */
const SCHEDULE_LIMIT = { maxRequests: 10, windowMs: 60 * 60 * 1000 };

const VALID_INTERVALS = new Set(["daily", "weekly", "manual"]);
const VALID_ANCHORS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export async function PATCH(request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = (await (supabase as any)
      .from("creators")
      .select("id, stripe_connect_id")
      .eq("member_id", user.id)
      .single()) as {
      data: {
        id: string;
        stripe_connect_id: string | null;
      } | null;
    };

    if (!creator) {
      return apiError("Creator profile not found.", 404);
    }
    if (!creator.stripe_connect_id) {
      return apiError("Connect Stripe first.", 422, {
        code: "stripe_account_missing",
      });
    }

    const limit = checkRateLimit(
      `payout_schedule:${creator.id}`,
      SCHEDULE_LIMIT.maxRequests,
      SCHEDULE_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return apiError("Too many schedule changes. Try again shortly.", 429, {
        code: "rate_limited",
        retry_after_ms: limit.retryAfterMs,
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      interval?: string;
      weekly_anchor?: string;
    };

    const interval = body.interval;
    if (!interval || !VALID_INTERVALS.has(interval)) {
      return apiError("interval must be daily, weekly, or manual.", 400, {
        code: "invalid_interval",
      });
    }

    const schedule: Stripe.AccountUpdateParams.Settings.Payouts.Schedule = {
      interval: interval as "daily" | "weekly" | "manual",
    };

    if (interval === "weekly") {
      const anchor = body.weekly_anchor;
      if (!anchor || !VALID_ANCHORS.has(anchor)) {
        return apiError(
          "weekly_anchor is required for weekly schedule.",
          400,
          { code: "invalid_weekly_anchor" }
        );
      }
      schedule.weekly_anchor = anchor as
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday";
    }

    try {
      await stripe.accounts.update(creator.stripe_connect_id, {
        settings: {
          payouts: { schedule },
        },
      });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        const code = err.code ?? err.type ?? "stripe_error";
        return apiError(err.message || "Stripe rejected the change.", 422, {
          code,
        });
      }
      throw err;
    }

    return apiSuccess({
      interval,
      weekly_anchor: schedule.weekly_anchor ?? null,
    });
  } catch (err) {
    console.error("[payout-schedule] failed:", err);
    return apiError("Schedule update failed.", 500, {
      code: "internal_error",
    });
  }
}
