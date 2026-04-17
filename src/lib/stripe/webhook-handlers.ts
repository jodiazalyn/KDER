import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";
import { isValidTransition } from "@/lib/order-state-machine";

// NOTE: We use (supabase as any) because the payment-related columns
// (stripe_payment_intent_id, paid_at, refund_amount, etc.) and tables
// (payouts) will be added via migration. Once the DB types are
// regenerated with `supabase gen types` these casts can be removed.

// ── checkout.session.completed ──────────────────────────────────
// A member paid for an order via Checkout. Mark order as paid and
// record the payment intent for later refund/payout tracking.
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.warn("[webhook] checkout.session.completed missing order_id");
    return;
  }

  const supabase = await createClient();

  // Fetch current order status to validate transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase as any)
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single() as { data: { status: OrderStatus } | null };

  const currentStatus = order?.status || "pending";
  const targetStatus: OrderStatus = "accepted";

  if (!isValidTransition(currentStatus, targetStatus)) {
    console.warn(
      `[webhook] Skipping invalid transition ${currentStatus} → ${targetStatus} for order ${orderId}`
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({
      status: targetStatus,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("[webhook] Failed to update order", orderId, error.message);
  } else {
    console.log("[webhook] Order", orderId, "marked as paid/accepted");
  }
}

// ── charge.succeeded ────────────────────────────────────────────
// Charge captured — mostly informational. We already handle payment
// via checkout.session.completed, but log for auditing.
export async function handleChargeSucceeded(charge: Stripe.Charge) {
  console.log(
    "[webhook] charge.succeeded",
    charge.id,
    "amount:",
    charge.amount / 100
  );
}

// ── charge.refunded ─────────────────────────────────────────────
// A refund was issued. Mark the order as cancelled and record the
// refund amount.
export async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId = charge.metadata?.order_id;
  if (!orderId) {
    console.warn("[webhook] charge.refunded missing order_id in metadata");
    return;
  }

  const supabase = await createClient();
  const refundAmount = charge.amount_refunded / 100;

  // Fetch current order status to validate transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase as any)
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single() as { data: { status: OrderStatus } | null };

  const currentStatus = order?.status || "accepted";
  const targetStatus: OrderStatus = "cancelled";

  if (!isValidTransition(currentStatus, targetStatus)) {
    console.warn(
      `[webhook] Skipping invalid refund transition ${currentStatus} → ${targetStatus} for order ${orderId}`
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({
      status: targetStatus,
      refund_amount: refundAmount,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("[webhook] Failed to refund order", orderId, error.message);
  } else {
    console.log("[webhook] Order", orderId, "refunded:", refundAmount);
  }
}

// ── payout.paid ─────────────────────────────────────────────────
// Creator payout landed in their bank. Update the earnings record.
export async function handlePayoutPaid(payout: Stripe.Payout) {
  const creatorId = payout.metadata?.creator_id;
  console.log(
    "[webhook] payout.paid",
    payout.id,
    "creator:",
    creatorId,
    "amount:",
    payout.amount / 100
  );

  if (!creatorId) return;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("payouts").insert({
    creator_id: creatorId,
    stripe_payout_id: payout.id,
    amount: payout.amount / 100,
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[webhook] Failed to record payout", error.message);
  }
}

// ── payout.failed ───────────────────────────────────────────────
// Creator payout failed (bad bank details, etc). Flag for review.
export async function handlePayoutFailed(payout: Stripe.Payout) {
  const creatorId = payout.metadata?.creator_id;
  console.error(
    "[webhook] payout.failed",
    payout.id,
    "creator:",
    creatorId,
    "reason:",
    payout.failure_message
  );

  if (!creatorId) return;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("payouts").insert({
    creator_id: creatorId,
    stripe_payout_id: payout.id,
    amount: payout.amount / 100,
    status: "failed",
    failure_reason: payout.failure_message,
  });

  if (error) {
    console.error("[webhook] Failed to record failed payout", error.message);
  }
}

// ── account.updated ─────────────────────────────────────────────
// Stripe Connect account KYC status changed. Update creator profile.
export async function handleAccountUpdated(account: Stripe.Account) {
  const creatorId = account.metadata?.creator_id;
  if (!creatorId) {
    console.warn("[webhook] account.updated missing creator_id in metadata");
    return;
  }

  const isVerified = account.charges_enabled && account.payouts_enabled;

  const supabase = await createClient();

  // Column names must match schema.sql: stripe_connect_id + kyc_status enum
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("creators")
    .update({
      stripe_connect_id: account.id,
      kyc_status: isVerified ? "verified" : "pending",
    })
    .eq("id", creatorId);

  if (error) {
    console.error("[webhook] Failed to update creator KYC", error.message);
  } else {
    console.log(
      "[webhook] Creator",
      creatorId,
      "KYC status:",
      isVerified ? "verified" : "pending"
    );
  }
}
