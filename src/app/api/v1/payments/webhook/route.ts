import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleChargeSucceeded,
  handleChargeRefunded,
  handlePayoutPaid,
  handlePayoutFailed,
  handleAccountUpdated,
} from "@/lib/stripe/webhook-handlers";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing Stripe signature" }),
      { status: 401 }
    );
  }

  const body = await request.text();

  // ── Verify signature ──────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Signature verification failed";
    console.error("[webhook] Verification failed:", message);
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  // ── Route events ──────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "payout.paid":
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case "payout.failed":
        await handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        console.log("[webhook] Unhandled event type:", event.type);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Event processing failed";
    console.error("[webhook] Processing error:", event.type, message);
    // Return 200 so Stripe doesn't retry — we log the error for debugging
    return new Response(JSON.stringify({ received: true, error: message }), {
      status: 200,
    });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
