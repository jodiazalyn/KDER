/**
 * Dispute / chargeback webhook notifier.
 *
 * When Stripe fires `charge.dispute.created` (or .updated/.closed), we
 * post to the same Slack incoming-webhook used for beta signups so the
 * ops team gets a real-time signal. A dispute can wipe a creator's
 * available balance silently — the creator-facing UI for this is a
 * follow-up, but until then we never want to find out about a chargeback
 * a week later from a Stripe email.
 *
 * Reuses BETA_SIGNUP_WEBHOOK_URL on purpose (single Slack channel for
 * ops events; one env var to manage). Fire-and-forget.
 */

interface DisputePayload {
  /** Stripe dispute ID (`dp_...`). */
  disputeId: string;
  /** Stripe charge ID (`ch_...`) the dispute is against. */
  chargeId: string;
  /** Lifecycle event that triggered this notification. */
  event: "created" | "updated" | "closed";
  /** Cents. */
  amountCents: number;
  /** ISO currency code, lowercase. */
  currency: string;
  /** Stripe's reason code (e.g. `fraudulent`, `product_not_received`). */
  reason: string | null;
  /** Stripe's status (e.g. `needs_response`, `under_review`, `won`, `lost`). */
  status: string | null;
  /** KDER order ID resolved from charge metadata, if available. */
  orderId?: string | null;
  /** Creator handle resolved from charge metadata, if available. */
  creatorHandle?: string | null;
}

export function notifyDispute(payload: DisputePayload): void {
  const url = process.env.BETA_SIGNUP_WEBHOOK_URL;
  if (!url) return;

  const dollars = (payload.amountCents / 100).toFixed(2);
  const orderLabel = payload.orderId ? ` order ${payload.orderId}` : "";
  const creatorLabel = payload.creatorHandle ? ` @${payload.creatorHandle}` : "";
  const ts = new Date().toISOString();
  const dashboardUrl = `https://dashboard.stripe.com/disputes/${payload.disputeId}`;

  const text = [
    `🚨 *KDER dispute ${payload.event}*${creatorLabel}`,
    `${payload.currency.toUpperCase()} $${dollars}${orderLabel}`,
    `Reason: ${payload.reason ?? "unknown"} · Status: ${payload.status ?? "unknown"}`,
    `Charge: ${payload.chargeId} · ${ts}`,
    `Stripe: ${dashboardUrl}`,
  ].join("\n");

  const body = {
    text,
    disputeId: payload.disputeId,
    chargeId: payload.chargeId,
    event: payload.event,
    amountCents: payload.amountCents,
    currency: payload.currency,
    reason: payload.reason,
    status: payload.status,
    orderId: payload.orderId ?? null,
    creatorHandle: payload.creatorHandle ?? null,
    timestamp: ts,
    dashboardUrl,
  };

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `[dispute-notifier] webhook returned ${res.status} dispute=${payload.disputeId}`
        );
      } else {
        console.log(
          `[dispute-notifier] sent ok dispute=${payload.disputeId} event=${payload.event}`
        );
      }
    })
    .catch((err) => {
      console.warn("[dispute-notifier] webhook delivery failed", err);
    });
}
