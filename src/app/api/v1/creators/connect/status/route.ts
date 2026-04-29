import { NextRequest } from "next/server";
import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";

/**
 * GET /api/v1/creators/connect/status — Return the current creator's
 * Stripe Connect readiness so the earnings page UI and the PlateForm
 * can render the right state (button, badge, disabled Active option).
 *
 * By default this is a fast DB-only read so PlateForm + the nav badge
 * don't pay a Stripe round-trip. Pass `?fresh=1` to additionally fetch
 * the live Stripe account and surface `currently_due_count`,
 * `disabled_reason`, and `payouts_enabled` for the Earn page banner.
 *
 * We deliberately do NOT return the raw stripe_connect_id to the client —
 * the account ID is a server-side secret we only pass to Stripe.
 */
export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get("fresh") === "1";

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
      .select(
        "stripe_connect_id, kyc_status, payouts_enabled, default_currency"
      )
      .eq("member_id", user.id)
      .single()) as {
      data: {
        stripe_connect_id: string | null;
        kyc_status: string | null;
        payouts_enabled: boolean | null;
        default_currency: string | null;
      } | null;
    };

    if (!creator) {
      return apiError("Creator profile not found.", 404);
    }

    const dbBundle = {
      kyc_status: creator.kyc_status || "not_started",
      has_account: Boolean(creator.stripe_connect_id),
      payouts_enabled: Boolean(creator.payouts_enabled),
      default_currency: creator.default_currency ?? "usd",
    };

    if (!fresh || !creator.stripe_connect_id) {
      return apiSuccess(dbBundle);
    }

    // Live read augment for the Earn page banner.
    try {
      const account = await stripe.accounts.retrieve(creator.stripe_connect_id);
      const isVerified =
        account.charges_enabled && account.payouts_enabled;
      const liveStatus = isVerified
        ? "verified"
        : account.requirements?.disabled_reason
          ? "failed"
          : "pending";

      return apiSuccess({
        ...dbBundle,
        kyc_status: liveStatus,
        payouts_enabled: Boolean(account.payouts_enabled),
        default_currency: account.default_currency ?? "usd",
        currently_due_count:
          account.requirements?.currently_due?.length ?? 0,
        disabled_reason: account.requirements?.disabled_reason ?? null,
      });
    } catch (err) {
      // Stripe outage — fall back to the DB cache. The UI shows a
      // small "Live status unavailable" hint by detecting the missing
      // `currently_due_count` field.
      if (err instanceof Stripe.errors.StripeError) {
        console.warn(
          "[connect/status?fresh=1] live read failed",
          err.code ?? err.type
        );
      } else {
        console.warn("[connect/status?fresh=1] live read failed", err);
      }
      return apiSuccess({
        ...dbBundle,
        live_unavailable: true,
      });
    }
  } catch (err) {
    console.error("Connect status error:", err);
    return apiError("Failed to load Connect status.", 500);
  }
}
