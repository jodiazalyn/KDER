import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";

/**
 * POST /api/v1/creators/connect/onboard — Start or resume Stripe Connect Express onboarding.
 *
 * If the creator doesn't have a Stripe Express account yet, one is created and
 * saved to creators.stripe_connect_id with kyc_status = 'pending'. Then an
 * account link is minted so the creator can complete (or update) KYC with Stripe.
 *
 * Account links are single-use and short-lived. If the one we return expires,
 * the earnings page auto-regenerates one via ?connect=refresh on the return URL.
 *
 * Stripe updates kyc_status via the `account.updated` webhook
 * (see src/lib/stripe/webhook-handlers.ts — handleAccountUpdated).
 */
export async function POST(request: NextRequest) {
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
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id, stripe_connect_id, kyc_status")
      .eq("member_id", user.id)
      .single() as {
        data: {
          id: string;
          stripe_connect_id: string | null;
          kyc_status: string | null;
        } | null;
      };

    if (!creator) {
      return apiError("Creator profile not found.", 404);
    }

    let stripeAccountId = creator.stripe_connect_id;

    // First-time onboarding: create the Express account and persist the id.
    if (!stripeAccountId) {
      // Supabase returns an empty string (not null/undefined) for phone-auth
      // users with no email on file — which Stripe rejects as `email_invalid`.
      // Use `||` so empty strings fall back to undefined and Stripe collects
      // the email itself during Express onboarding.
      const emailOrUndefined = user.email || undefined;

      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: emailOrUndefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          creator_id: creator.id,
          member_id: user.id,
        },
      });

      stripeAccountId = account.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("creators")
        .update({
          stripe_connect_id: stripeAccountId,
          kyc_status: "pending",
        })
        .eq("id", creator.id);

      if (updateErr) {
        console.error("Failed to save stripe_connect_id:", updateErr);
        return apiError("Failed to initialize Stripe Connect.", 500);
      }
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/earnings?connect=refresh`,
      return_url: `${origin}/earnings?connect=complete`,
      type: "account_onboarding",
    });

    return apiSuccess({ url: accountLink.url });
  } catch (err) {
    console.error("Connect onboard error:", err);
    return apiError("Failed to start Stripe Connect onboarding.", 500);
  }
}
