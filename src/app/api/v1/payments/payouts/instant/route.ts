import { NextRequest } from "next/server";
import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/v1/payments/payouts/instant
 *
 * Body: `{ amount_cents: number }` — the NET amount the creator wants
 * to RECEIVE, in cents (positive integer). We gross this up by the
 * Stripe instant payout fee before calling Stripe so the creator
 * actually receives the amount they requested.
 *
 * Headers: `Idempotency-Key: <uuid>` REQUIRED. Client mints a UUID
 * when the confirm sheet opens and reuses it through the request.
 * Stripe rejects duplicate keys for the same params, preventing
 * double-payouts on a network retry / double-tap.
 *
 * Calls `stripe.payouts.create({ method: 'instant' })` against the
 * creator's connected account. Stripe's 1.5% instant payout fee is
 * applied via our platform pricing scheme (Stripe Dashboard →
 * Connect → Platform pricing → Instant payouts) and lands in our
 * platform balance to offset what Stripe bills us — net financial
 * impact on KDER is zero (pure pass-through).
 *
 * Errors mapped to client-friendly messages with the Stripe error
 * code in `extras.code` so the toast can show "[code]" for
 * one-screenshot debugging.
 */
const INSTANT_PAYOUT_LIMIT = { maxRequests: 3, windowMs: 60 * 60 * 1000 };

/**
 * Stripe's instant payout fee rate as configured in our platform
 * pricing scheme. Pure pass-through to Stripe. If Stripe's fee
 * changes (or we ever apply a markup), update this constant in
 * lockstep with the dashboard scheme.
 */
const STRIPE_INSTANT_PAYOUT_FEE_RATE = 0.015;

export async function POST(request: NextRequest) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return apiError(
        "Missing Idempotency-Key header.",
        400,
        { code: "missing_idempotency_key" }
      );
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
      return apiError(
        "Connect Stripe to start receiving payouts.",
        422,
        { code: "stripe_account_missing" }
      );
    }
    if (creator.kyc_status !== "verified") {
      return apiError(
        "Finish your Stripe verification before requesting a payout.",
        422,
        { code: "kyc_not_verified" }
      );
    }

    // Rate limit: 3/hour/creator. Discourages abuse + protects Stripe
    // quota. Returns 429 with retry-after.
    const limit = checkRateLimit(
      `instant_payout:${creator.id}`,
      INSTANT_PAYOUT_LIMIT.maxRequests,
      INSTANT_PAYOUT_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return apiError(
        `Too many instant payout requests. Try again in ${Math.ceil(limit.retryAfterMs / 60000)} min.`,
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
    const netAmountCents = Number(body.amount_cents);
    if (!Number.isInteger(netAmountCents) || netAmountCents <= 0) {
      return apiError(
        "amount_cents must be a positive integer.",
        400,
        { code: "invalid_amount" }
      );
    }

    // Gross up so the creator receives the net amount they requested.
    //
    // Stripe debits the gross from the available balance; the 1.5%
    // application_fee comes off the top per the platform pricing
    // scheme. So if creator wants $100 net:
    //   gross = ceil(10000 / 0.985) = 10153 cents ($101.53)
    //   Stripe debits $101.53, sends $100 to the card, $1.53 → KDER fee
    //
    // ceil (vs floor) guarantees the creator never receives LESS than
    // they asked for; worst case is a 1-cent overage to them, which
    // we accept as a rounding artifact.
    const grossAmountCents = Math.ceil(
      netAmountCents / (1 - STRIPE_INSTANT_PAYOUT_FEE_RATE)
    );

    try {
      const payout = await stripe.payouts.create(
        {
          amount: grossAmountCents,
          currency: "usd",
          method: "instant",
          // Most banks (Chase/BofA/Wells/etc.) surface this on the
          // recipient's statement so creators recognize the credit.
          // Apple Cash specifically ignores it — there's no Stripe
          // field that overrides Apple's "Refund" labeling for
          // Visa Direct OCT inbound credits. Constraints: ≤22 chars,
          // alphanumeric + spaces + periods only.
          statement_descriptor: "KDER PAYOUT",
          metadata: {
            creator_id: creator.id,
            net_amount_cents: String(netAmountCents),
          },
        },
        {
          stripeAccount: creator.stripe_connect_id,
          idempotencyKey,
        }
      );

      return apiSuccess({
        payout_id: payout.id,
        // Gross is what Stripe debited from the balance; net is what
        // the creator actually receives. Surface both so the client
        // can render either without re-doing the math.
        amount_cents: payout.amount,
        net_amount_cents: netAmountCents,
        method: payout.method,
        status: payout.status,
        arrival_date: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
      });
    } catch (err) {
      return mapStripeError(err);
    }
  } catch (err) {
    console.error("[/api/v1/payments/payouts/instant] failed:", err);
    return apiError("Instant payout failed.", 500, {
      code: "internal_error",
    });
  }
}

function mapStripeError(err: unknown) {
  if (err instanceof Stripe.errors.StripeError) {
    const code = err.code ?? err.type ?? "stripe_error";
    // Common cases:
    //   - balance_insufficient → "No balance available"
    //   - payouts_not_allowed  → bank-only account, no debit card
    //   - account_invalid      → Connect account state issue
    if (code === "balance_insufficient") {
      return apiError("No balance available for payout.", 422, { code });
    }
    if (code === "payouts_not_allowed") {
      return apiError(
        "Add a debit card in Stripe to enable instant payouts.",
        422,
        { code }
      );
    }
    return apiError(err.message || "Stripe rejected the payout.", 422, {
      code,
    });
  }
  console.error("[instant-payout] non-Stripe error:", err);
  return apiError("Instant payout failed.", 500, { code: "internal_error" });
}
