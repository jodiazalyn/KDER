import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyUberWebhook } from "@/lib/uber-direct/verify-webhook";
import {
  decideStatusUpdate,
  extractDeliveryEvent,
} from "@/lib/uber-direct/webhook-event";
import type { UberWebhookEnvelope } from "@/lib/uber-direct/types";

// node:crypto (HMAC verification) requires the Node runtime — never edge.
export const runtime = "nodejs";

/**
 * POST /api/v1/uber/webhook
 *
 * Inbound delivery-status callbacks from Uber Direct. This route is
 * the **single writer** of orders.uber_status (see migration 019):
 * booking sets the initial status, and every subsequent transition
 * (pickup → pickup_complete → dropoff → delivered, or canceled /
 * returned) arrives here.
 *
 * Flow: verify HMAC signature → parse envelope → map to a KDER order
 * (by external_id = order.id, falling back to uber_delivery_id) →
 * apply the transition if the decision logic allows it.
 *
 * Response policy mirrors the Stripe webhook: after a *valid*
 * signature we return 200 for anything we intentionally skip (non-
 * status pings, unknown statuses, unmappable orders, guarded
 * transitions) so Uber doesn't enter a retry storm. We only return
 * 5xx for transient failures we genuinely want retried (missing
 * service key, DB write error). Bad/absent signature → 401.
 *
 * Register the public URL of this route in the Uber Direct dashboard
 * (Webhooks). The signing scheme is HMAC-SHA256(rawBody) sent as a
 * hex digest in `X-Uber-Signature` — confirm the exact header name +
 * algorithm in the dashboard during sandbox bring-up and adjust
 * verify-webhook.ts if Uber differs.
 */
export async function POST(request: NextRequest) {
  // Read the secret per-invocation (+ trim) so a Netlify env change
  // takes effect on the next cold start without a redeploy, and stray
  // whitespace from a dashboard paste can't break verification.
  const secret = (process.env.UBER_DIRECT_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    console.error("[uber.webhook] UBER_DIRECT_WEBHOOK_SECRET is not set");
    return json({ error: "Webhook secret not configured" }, 500);
  }

  // Raw body bytes — the signature is computed over the bytes as
  // transmitted, so we must NOT re-serialize parsed JSON.
  const rawBody = await request.text();
  const signature = request.headers.get("x-uber-signature");

  const verified = verifyUberWebhook({
    rawBody,
    headers: { "x-uber-signature": signature },
    secret,
  });
  if (!verified) {
    // Safe-to-expose diagnostics (never the secret itself) so logs
    // reveal whether it's a missing header, length mismatch, or body
    // mutation while we confirm Uber's exact signing scheme.
    console.error("[uber.webhook] signature verification failed", {
      hasSignatureHeader: Boolean(signature),
      signatureLength: signature?.length ?? 0,
      bodyLength: rawBody.length,
      secretLength: secret.length,
    });
    return json({ error: "Invalid signature" }, 401);
  }

  let envelope: UberWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as UberWebhookEnvelope;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const event = extractDeliveryEvent(envelope);

    // Non-status events (courier location pings, etc.) carry no status
    // we act on — ack and move on.
    if (!event.status) {
      console.log("[uber.webhook] non-status event, skipping", {
        kind: envelope.kind ?? null,
        delivery_id: event.deliveryId ?? null,
      });
      return json({ received: true, skipped: "non-status-event" }, 200);
    }

    const supabase = createServiceClient();
    if (!supabase) {
      // We verified the signature, so this is a real event we'd be
      // dropping. 500 → Uber retries once the key is configured.
      console.error(
        "[uber.webhook] SUPABASE_SERVICE_ROLE_KEY not configured — cannot write status"
      );
      return json({ error: "Server not configured" }, 500);
    }
    // Generated DB types predate migration 019's uber_* columns; cast
    // until `supabase gen types` is re-run (same pattern as the Stripe
    // webhook handlers).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    type OrderRow = {
      id: string;
      uber_status: string | null;
      uber_status_updated_at: string | null;
    };
    const cols = "id, uber_status, uber_status_updated_at";

    // Prefer external_id (we set it to order.id at booking); fall back
    // to the Uber delivery id persisted on the order row.
    let order: OrderRow | null = null;
    if (event.externalId) {
      const { data } = await db
        .from("orders")
        .select(cols)
        .eq("id", event.externalId)
        .maybeSingle();
      order = (data as OrderRow) ?? null;
    }
    if (!order && event.deliveryId) {
      const { data } = await db
        .from("orders")
        .select(cols)
        .eq("uber_delivery_id", event.deliveryId)
        .maybeSingle();
      order = (data as OrderRow) ?? null;
    }

    if (!order) {
      console.warn("[uber.webhook] no matching order", {
        external_id: event.externalId ?? null,
        delivery_id: event.deliveryId ?? null,
        status: event.status,
      });
      return json({ received: true, skipped: "no-matching-order" }, 200);
    }

    const decision = decideStatusUpdate(
      {
        uber_status: order.uber_status,
        uber_status_updated_at: order.uber_status_updated_at,
      },
      { status: event.status, eventTimeMs: event.eventTimeMs }
    );
    if (!decision.apply) {
      console.log("[uber.webhook] skipping status update", {
        order_id: order.id,
        from: order.uber_status,
        to: event.status,
        reason: decision.reason,
      });
      return json({ received: true, skipped: decision.reason }, 200);
    }

    const statusUpdatedAt =
      event.eventTimeMs != null
        ? new Date(event.eventTimeMs).toISOString()
        : new Date().toISOString();

    const update: Record<string, unknown> = {
      uber_status: event.status,
      uber_status_updated_at: statusUpdatedAt,
    };
    // Tracking URL can change/appear mid-lifecycle; keep it fresh when sent.
    if (event.trackingUrl) update.uber_tracking_url = event.trackingUrl;

    const { error: updErr } = await db
      .from("orders")
      .update(update)
      .eq("id", order.id);

    if (updErr) {
      console.error("[uber.webhook] order update failed", {
        order_id: order.id,
        status: event.status,
        error: updErr.message,
      });
      // Transient — let Uber retry.
      return json({ error: "DB update failed" }, 500);
    }

    console.log("[uber.webhook] order status updated", {
      order_id: order.id,
      from: order.uber_status,
      to: event.status,
      event_time: statusUpdatedAt,
    });
    return json({ received: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Already signature-verified — ack to avoid retry storms; we logged it.
    console.error("[uber.webhook] processing error", message);
    return json({ received: true, error: message }, 200);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
