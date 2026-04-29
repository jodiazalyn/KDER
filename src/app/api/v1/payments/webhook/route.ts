import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleChargeSucceeded,
  handleChargeRefunded,
  handlePayoutCreated,
  handlePayoutUpdated,
  handlePayoutPaid,
  handlePayoutFailed,
  handlePayoutCanceled,
  handleAccountUpdated,
  handleDisputeCreated,
  handleDisputeUpdated,
  handleDisputeClosed,
} from "@/lib/stripe/webhook-handlers";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  // Read + trim the secret on every invocation (not at module load) so an
  // env-var change in Netlify takes effect on the next cold start without
  // needing code redeployment. Trim guards against whitespace/newlines that
  // sneak in when pasting the secret into dashboards.
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();

  if (!webhookSecret) {
    console.error(
      "[webhook] STRIPE_WEBHOOK_SECRET is not set in the environment"
    );
    return new Response(
      JSON.stringify({ error: "Webhook secret not configured" }),
      { status: 500 }
    );
  }

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
    // Log safe-to-expose diagnostics so Netlify logs reveal whether the
    // problem is a missing secret, wrong prefix, length mismatch, or body
    // mutation — without ever logging the secret itself.
    console.error("[webhook] Verification failed:", message, {
      secretLength: webhookSecret.length,
      secretPrefix: webhookSecret.slice(0, 6), // "whsec_" expected
      secretStartsWithWhsec: webhookSecret.startsWith("whsec_"),
      bodyLength: body.length,
      signatureHeaderLength: signature.length,
    });
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

      case "payout.created":
        await handlePayoutCreated(event.data.object as Stripe.Payout);
        break;

      case "payout.updated":
        await handlePayoutUpdated(event.data.object as Stripe.Payout);
        break;

      case "payout.paid":
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case "payout.failed":
        await handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      case "payout.canceled":
        await handlePayoutCanceled(event.data.object as Stripe.Payout);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.updated":
        await handleDisputeUpdated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
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
