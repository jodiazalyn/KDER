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
  handleCateringDepositSucceeded,
} from "@/lib/stripe/webhook-handlers";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  // Read + trim the secrets on every invocation (not at module load) so an
  // env-var change in Netlify takes effect on the next cold start without
  // needing code redeployment. Trim guards against whitespace/newlines that
  // sneak in when pasting the secret into dashboards.
  //
  // We run TWO Stripe event destinations that both POST here, each with its
  // own signing secret:
  //   - STRIPE_WEBHOOK_SECRET          → the "Connected accounts" destination
  //     (payout.* + account.updated — events emitted by creators' connected
  //     accounts).
  //   - STRIPE_WEBHOOK_SECRET_PLATFORM → the "Your account" destination
  //     (checkout.session.completed, payment_intent.succeeded, charge.*,
  //     charge.dispute.* — events that fire on the platform account, e.g. the
  //     destination-charge checkout that stamps an order's paid_at).
  // A given request is signed by exactly one of them, so we try each secret
  // and accept on the first that verifies. (Historically only the connected
  // secret existed, which silently dropped every checkout.session.completed
  // and left orders.paid_at NULL forever.)
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_PLATFORM,
  ]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);

  if (webhookSecrets.length === 0) {
    console.error(
      "[webhook] No signing secret set (STRIPE_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET_PLATFORM)"
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

  // ── Verify signature (try each configured destination secret) ─────
  let event: Stripe.Event | null = null;
  let lastError = "Signature verification failed";
  for (const secret of webhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : "Signature verification failed";
    }
  }

  if (!event) {
    // Log safe-to-expose diagnostics so Netlify logs reveal whether the
    // problem is a missing secret, wrong prefix, length mismatch, or body
    // mutation — without ever logging the secret values themselves.
    console.error(
      "[webhook] Verification failed against all secrets:",
      lastError,
      {
        secretsTried: webhookSecrets.length,
        secretPrefixes: webhookSecrets.map((s) => s.slice(0, 6)), // "whsec_" expected
        allStartWithWhsec: webhookSecrets.every((s) => s.startsWith("whsec_")),
        bodyLength: body.length,
        signatureHeaderLength: signature.length,
      }
    );
    return new Response(JSON.stringify({ error: lastError }), { status: 400 });
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

      case "payment_intent.succeeded": {
        // Routed by metadata.type — catering deposits go to the catering
        // handler, anything else is logged as unhandled. Adding more
        // PaymentIntent flows later (e.g., catering balance in PR 4)
        // means another branch here.
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.type === "catering_deposit") {
          await handleCateringDepositSucceeded(pi);
        } else {
          console.log(
            "[webhook] Unhandled payment_intent.succeeded type:",
            pi.metadata?.type ?? "(none)"
          );
        }
        break;
      }

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
