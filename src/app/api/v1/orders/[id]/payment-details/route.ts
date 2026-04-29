import Stripe from "stripe";
import { apiSuccess, apiError } from "@/lib/api";
import { stripe } from "@/lib/stripe/client";

/**
 * GET /api/v1/orders/[id]/payment-details
 *
 * Lazy-fetches Stripe payment intent + transfer info for one order.
 * Used by the per-order drawer in the Earn tab so creators can see
 * the canonical Stripe IDs (`pi_...`, `ch_...`, `tr_...`) — useful
 * when reconciling a payout against a specific order or filing a
 * support ticket with Stripe.
 *
 * Authorization: only the creator of the order can read its details.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await ctx.params;
    if (!orderId) return apiError("Missing order id.", 400);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = (await (supabase as any)
      .from("orders")
      .select("id, creator_id, stripe_payment_intent_id, total_amount")
      .eq("id", orderId)
      .single()) as {
      data: {
        id: string;
        creator_id: string;
        stripe_payment_intent_id: string | null;
        total_amount: number | string | null;
      } | null;
    };

    if (!order) {
      return apiError("Order not found.", 404);
    }

    // Verify the requester owns this order via creators.member_id.
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

    if (!creator || creator.id !== order.creator_id) {
      return apiError("Not authorized.", 403);
    }

    if (!order.stripe_payment_intent_id) {
      return apiSuccess({
        payment_intent_id: null,
        charge_id: null,
        transfer_id: null,
      });
    }

    try {
      // Expand latest_charge AND its transfer so we get the connected-
      // account transfer ID in one round trip.
      const pi = (await stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id,
        {
          expand: ["latest_charge.transfer"],
        }
      )) as Stripe.PaymentIntent & {
        latest_charge: Stripe.Charge | string | null;
      };

      let chargeId: string | null = null;
      let transferId: string | null = null;
      if (pi.latest_charge && typeof pi.latest_charge !== "string") {
        chargeId = pi.latest_charge.id;
        const transfer = pi.latest_charge.transfer;
        transferId =
          typeof transfer === "string"
            ? transfer
            : transfer?.id ?? null;
      } else if (typeof pi.latest_charge === "string") {
        chargeId = pi.latest_charge;
      }

      return apiSuccess({
        payment_intent_id: pi.id,
        charge_id: chargeId,
        transfer_id: transferId,
      });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        const code = err.code ?? err.type ?? "stripe_error";
        return apiError(err.message || "Couldn't load payment.", 422, {
          code,
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("[payment-details] failed:", err);
    return apiError("Couldn't load payment details.", 500, {
      code: "internal_error",
    });
  }
}
