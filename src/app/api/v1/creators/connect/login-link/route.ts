import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/v1/creators/connect/login-link
 *
 * Mints a single-use, ~5min-expiry URL to the creator's Stripe Express
 * dashboard. Used by the "Manage in Stripe" button on the Earn page so
 * creators can edit bank info, view tax docs, etc. without us building
 * UI for every Stripe-owned setting.
 *
 * Mint on click only — links are single-use, so generating at page load
 * would burn the URL before the creator could click it.
 */
const LOGIN_LINK_LIMIT = { maxRequests: 20, windowMs: 60 * 60 * 1000 };

export async function POST() {
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
      `login_link:${creator.id}`,
      LOGIN_LINK_LIMIT.maxRequests,
      LOGIN_LINK_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return apiError("Too many requests. Try again shortly.", 429, {
        code: "rate_limited",
        retry_after_ms: limit.retryAfterMs,
      });
    }

    try {
      const link = await stripe.accounts.createLoginLink(
        creator.stripe_connect_id
      );
      return apiSuccess({ url: link.url });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        const code = err.code ?? err.type ?? "stripe_error";
        return apiError(err.message || "Couldn't open Stripe.", 422, {
          code,
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("[login-link] failed:", err);
    return apiError("Couldn't open Stripe dashboard.", 500, {
      code: "internal_error",
    });
  }
}
