import { NextRequest } from "next/server";
import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/v1/payments/payouts/standard
 *
 * On-demand standard payout. Same shape as the instant route but
 * `method: 'standard'` and no Stripe fee. Server gates on the
 * creator's payout schedule being `manual` — calling this when
 * Stripe's auto-schedule (Daily/Weekly) is active risks the
 * "I just got swept" confusion (Stripe may have already pulled
 * the available balance), so we 422 those callers.
 *
 * Headers: `Idempotency-Key: <uuid>` REQUIRED.
 * Body: `{ amount_cents: number }`.
 */
const STANDARD_PAYOUT_LIMIT = { maxRequests: 5, windowMs: 60 * 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return apiError("Missing Idempotency-Key header.", 400, {
        code: "missing_idempotency_key",
      });
    }

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
      .select("id, stripe_connect_id, kyc_status")
      .eq("member_id", user.id)
      .single()) as {
      data: {
        id: string;
        stripe_connect_id: string | null;
        kyc_status: string | null;
      } | null;
    };

    if (!creator) {
      return apiError("Creator profile not found.", 404);
    }
    if (!creator.stripe_connect_id) {
      return apiError("Connect Stripe to start receiving payouts.", 422, {
        code: "stripe_account_missing",
      });
    }
    if (creator.kyc_status !== "verified") {
      return apiError(
        "Finish your Stripe verification before requesting a payout.",
        422,
        { code: "kyc_not_verified" }
      );
    }

    // Verify schedule is manual. Live read so we don't trust a stale
    // local cache here.
    let scheduleInterval = "daily";
    try {
      const account = await stripe.accounts.retrieve(
        creator.stripe_connect_id
      );
      scheduleInterval =
        account.settings?.payouts?.schedule?.interval ?? "daily";
    } catch (err) {
      console.warn("[standard-payout] accounts.retrieve failed", err);
      return apiError(
        "Couldn't verify your payout schedule. Try again.",
        503,
        { code: "stripe_unavailable" }
      );
    }

    if (scheduleInterval !== "manual") {
      return apiError(
        "On-demand standard payouts are only available when your payout schedule is Manual. Switch to Manual in Payout Schedule first.",
        422,
        { code: "schedule_not_manual" }
      );
    }

    const limit = checkRateLimit(
      `standard_payout:${creator.id}`,
      STANDARD_PAYOUT_LIMIT.maxRequests,
      STANDARD_PAYOUT_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return apiError(
        `Too many payout requests. Try again in ${Math.ceil(limit.retryAfterMs / 60000)} min.`,
        429,
        {
          code: "rate_limited",
          retry_after_ms: limit.retryAfterMs,
        }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      amount_cents?: number;
    };
    const amountCents = Number(body.amount_cents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return apiError("amount_cents must be a positive integer.", 400, {
        code: "invalid_amount",
      });
    }

    try {
      const payout = await stripe.payouts.create(
        {
          amount: amountCents,
          currency: "usd",
          method: "standard",
          metadata: {
            creator_id: creator.id,
          },
        },
        {
          stripeAccount: creator.stripe_connect_id,
          idempotencyKey,
        }
      );

      return apiSuccess({
        payout_id: payout.id,
        amount_cents: payout.amount,
        method: payout.method,
        status: payout.status,
        arrival_date: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
      });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        const code = err.code ?? err.type ?? "stripe_error";
        if (code === "balance_insufficient") {
          return apiError("No balance available for payout.", 422, { code });
        }
        return apiError(
          err.message || "Stripe rejected the payout.",
          422,
          { code }
        );
      }
      console.error("[standard-payout] non-Stripe error:", err);
      return apiError("Standard payout failed.", 500, {
        code: "internal_error",
      });
    }
  } catch (err) {
    console.error("[/api/v1/payments/payouts/standard] failed:", err);
    return apiError("Standard payout failed.", 500, {
      code: "internal_error",
    });
  }
}
