import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";
import { isValidTransition } from "@/lib/order-state-machine";
import { notifyDispute } from "@/lib/dispute-notifier";

// We use (supabase as any) for payment-related writes because the
// generated DB types haven't been regenerated since migration 001+004
// added the payment columns. Run `supabase gen types` to regenerate
// and these casts can be removed.

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
export async function handleChargeSucceeded(charge: Stripe.Charge) {
  console.log(
    "[webhook] charge.succeeded",
    charge.id,
    "amount:",
    charge.amount / 100
  );
}

// ── charge.refunded ─────────────────────────────────────────────
export async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId = charge.metadata?.order_id;
  if (!orderId) {
    console.warn("[webhook] charge.refunded missing order_id in metadata");
    return;
  }

  const supabase = await createClient();
  const refundAmount = charge.amount_refunded / 100;

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

// ── Payout helpers ──────────────────────────────────────────────
// All payout.* events upsert by stripe_payout_id so the lifecycle
// (created → in_transit → paid|failed) doesn't duplicate rows.

function payoutRow(payout: Stripe.Payout, status: string) {
  return {
    creator_id: payout.metadata?.creator_id ?? null,
    stripe_payout_id: payout.id,
    amount: payout.amount / 100,
    amount_cents: payout.amount,
    fee_cents: payout.application_fee_amount ?? 0,
    method: (payout.method ?? "standard") as "standard" | "instant",
    arrival_date: payout.arrival_date
      ? new Date(payout.arrival_date * 1000).toISOString()
      : null,
    status,
    failure_reason: payout.failure_message ?? null,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  };
}

async function upsertPayout(payout: Stripe.Payout, status: string) {
  const creatorId = payout.metadata?.creator_id;
  if (!creatorId) {
    console.warn(
      `[webhook] payout.${status} missing creator_id in metadata`,
      payout.id
    );
    return;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("payouts")
    .upsert(payoutRow(payout, status), { onConflict: "stripe_payout_id" });

  if (error) {
    console.error(
      `[webhook] Failed to upsert payout ${payout.id} status=${status}`,
      error.message
    );
  } else {
    console.log(
      `[webhook] payout.${status}`,
      payout.id,
      "creator:",
      creatorId,
      "amount:",
      payout.amount / 100
    );
  }
}

// ── payout.* lifecycle ──────────────────────────────────────────
export async function handlePayoutCreated(payout: Stripe.Payout) {
  return upsertPayout(payout, "pending");
}

export async function handlePayoutUpdated(payout: Stripe.Payout) {
  // payout.status reflects Stripe's current state; map it through.
  // `pending` and `in_transit` collapse to `pending` in our schema's
  // CHECK constraint (paid/pending/failed only).
  const status =
    payout.status === "paid"
      ? "paid"
      : payout.status === "failed"
        ? "failed"
        : "pending";
  return upsertPayout(payout, status);
}

export async function handlePayoutPaid(payout: Stripe.Payout) {
  return upsertPayout(payout, "paid");
}

export async function handlePayoutFailed(payout: Stripe.Payout) {
  console.error(
    "[webhook] payout.failed",
    payout.id,
    "creator:",
    payout.metadata?.creator_id,
    "reason:",
    payout.failure_message
  );
  return upsertPayout(payout, "failed");
}

export async function handlePayoutCanceled(payout: Stripe.Payout) {
  // Schema CHECK only allows paid/pending/failed — bucket cancel as failed
  // with a clear failure_reason so the UI can surface "Payout cancelled".
  console.log("[webhook] payout.canceled", payout.id);
  const supabase = await createClient();
  const row = {
    ...payoutRow(payout, "failed"),
    failure_reason: payout.failure_message ?? "Payout cancelled in Stripe",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("payouts")
    .upsert(row, { onConflict: "stripe_payout_id" });
  if (error) {
    console.error(
      `[webhook] Failed to record canceled payout ${payout.id}`,
      error.message
    );
  }
}

// ── account.updated ─────────────────────────────────────────────
// Stripe Connect account changed. Sync KYC + cache hot-path booleans
// (payouts_enabled, default_currency) so checkout doesn't have to
// hit Stripe per-order to gate on payout eligibility.
export async function handleAccountUpdated(account: Stripe.Account) {
  const creatorId = account.metadata?.creator_id;
  if (!creatorId) {
    console.warn("[webhook] account.updated missing creator_id in metadata");
    return;
  }

  const isVerified = account.charges_enabled && account.payouts_enabled;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("creators")
    .update({
      stripe_connect_id: account.id,
      kyc_status: isVerified ? "verified" : "pending",
      payouts_enabled: account.payouts_enabled ?? false,
      default_currency: account.default_currency ?? "usd",
    })
    .eq("id", creatorId);

  if (error) {
    console.error("[webhook] Failed to update creator KYC", error.message);
  } else {
    console.log(
      "[webhook] Creator",
      creatorId,
      "KYC:",
      isVerified ? "verified" : "pending",
      "payouts_enabled:",
      account.payouts_enabled
    );
  }
}

// ── charge.dispute.* ────────────────────────────────────────────
// Stub handler. Records the dispute to our DB and pings Slack via the
// shared beta-signup webhook so ops gets a real-time signal. Creator-
// facing UI is a deferred follow-up; this is the safety rail until then.

async function recordDispute(
  dispute: Stripe.Dispute,
  event: "created" | "updated" | "closed"
) {
  const supabase = await createClient();

  // The charge's metadata carries our order_id (set in checkout/route.ts).
  // Stripe's `dispute.charge` is either a string or an expanded object
  // depending on event source — handle both.
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  const chargeMeta =
    typeof dispute.charge === "string" ? null : dispute.charge.metadata;
  const orderId = chargeMeta?.order_id ?? null;
  const creatorHandle = chargeMeta?.creator_handle ?? null;

  // Resolve creator_id from order if available so the RLS policy works.
  let creatorId: string | null = null;
  if (orderId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("creator_id")
      .eq("id", orderId)
      .single();
    creatorId = order?.creator_id ?? null;
  }

  const row = {
    stripe_dispute_id: dispute.id,
    stripe_charge_id: chargeId,
    order_id: orderId,
    creator_id: creatorId,
    amount_cents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("disputes")
    .upsert(row, { onConflict: "stripe_dispute_id" });

  if (error) {
    console.error(
      `[webhook] Failed to record dispute ${dispute.id} event=${event}`,
      error.message
    );
  } else {
    console.log(
      `[webhook] dispute.${event}`,
      dispute.id,
      "charge:",
      chargeId,
      "amount:",
      dispute.amount / 100,
      "reason:",
      dispute.reason
    );
  }

  notifyDispute({
    disputeId: dispute.id,
    chargeId,
    event,
    amountCents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    orderId,
    creatorHandle,
  });
}

export async function handleDisputeCreated(dispute: Stripe.Dispute) {
  return recordDispute(dispute, "created");
}

export async function handleDisputeUpdated(dispute: Stripe.Dispute) {
  return recordDispute(dispute, "updated");
}

export async function handleDisputeClosed(dispute: Stripe.Dispute) {
  return recordDispute(dispute, "closed");
}
