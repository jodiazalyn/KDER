/**
 * Pure logic for the Uber Direct delivery-status webhook.
 *
 * Kept separate from the route handler so the parsing + the
 * status-transition decision can be unit-tested without standing
 * up a request, env vars, or a Supabase client. The route
 * (src/app/api/v1/uber/webhook/route.ts) does I/O + signature
 * verification and delegates every judgement call to here.
 */

import type { UberDeliveryStatus, UberWebhookEnvelope } from "./types";

/** The full Uber Direct delivery state machine. Mirrors the CHECK
 *  constraint on orders.uber_status (migration 019) — keep in sync. */
export const DELIVERY_STATUSES: readonly UberDeliveryStatus[] = [
  "pending",
  "pickup",
  "pickup_complete",
  "dropoff",
  "delivered",
  "canceled",
  "returned",
] as const;

/** States the delivery can't move OUT of. Once an order lands here,
 *  a later (possibly out-of-order) webhook for an earlier state must
 *  not regress it. */
export const TERMINAL_STATUSES: ReadonlySet<UberDeliveryStatus> = new Set([
  "delivered",
  "canceled",
  "returned",
]);

export function isDeliveryStatus(v: unknown): v is UberDeliveryStatus {
  return (
    typeof v === "string" &&
    (DELIVERY_STATUSES as readonly string[]).includes(v)
  );
}

export interface DeliveryEvent {
  /** Uber delivery id (del_xxx), from data.id or top-level delivery_id. */
  deliveryId?: string;
  /** Our cross-ref — we set external_id = KDER order.id at booking. */
  externalId?: string;
  /** Normalized delivery status, or undefined for non-status events
   *  (e.g. courier location pings) and unrecognized statuses. */
  status?: UberDeliveryStatus;
  trackingUrl?: string;
  /** Event timestamp normalized to epoch ms, when present. */
  eventTimeMs?: number;
}

/**
 * Pull the fields we care about out of an Uber webhook envelope,
 * defensively. Uber's webhook payload shape isn't in the OpenAPI
 * spec and varies a little by event type, so every field is
 * optional and validated.
 */
export function extractDeliveryEvent(
  envelope: UberWebhookEnvelope
): DeliveryEvent {
  const data = (envelope.data ?? {}) as Record<string, unknown>;

  const status = isDeliveryStatus(data.status) ? data.status : undefined;
  const deliveryId =
    pickString(data.id) ?? pickString(envelope.delivery_id) ?? undefined;
  const externalId = pickString(data.external_id) ?? undefined;
  const trackingUrl = pickString(data.tracking_url) ?? undefined;
  const eventTimeMs = parseEventTime(envelope.event_time);

  return { deliveryId, externalId, status, trackingUrl, eventTimeMs };
}

/**
 * Decide whether an incoming status should overwrite what's stored.
 *
 * Rules (order matters):
 *   1. Terminal guard — never move out of delivered/canceled/returned.
 *      A duplicate of the same terminal status is a no-op, not an error.
 *   2. No-change — same status as stored, skip (idempotent replays).
 *   3. Staleness — if we can compare timestamps and the incoming event
 *      is older than what we last wrote, skip (out-of-order delivery).
 *   4. Otherwise apply.
 */
export function decideStatusUpdate(
  current: { uber_status: string | null; uber_status_updated_at: string | null },
  incoming: { status: UberDeliveryStatus; eventTimeMs?: number }
): { apply: boolean; reason: string } {
  const cur = current.uber_status;

  if (isDeliveryStatus(cur) && TERMINAL_STATUSES.has(cur)) {
    return cur === incoming.status
      ? { apply: false, reason: "duplicate-terminal" }
      : { apply: false, reason: "post-terminal" };
  }

  if (cur === incoming.status) {
    return { apply: false, reason: "no-change" };
  }

  if (incoming.eventTimeMs != null && current.uber_status_updated_at) {
    const curMs = Date.parse(current.uber_status_updated_at);
    if (!Number.isNaN(curMs) && incoming.eventTimeMs < curMs) {
      return { apply: false, reason: "stale-event" };
    }
  }

  return { apply: true, reason: "ok" };
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Accept epoch seconds, epoch ms, or an RFC-3339 string; return ms. */
function parseEventTime(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    // < 1e12 ⇒ looks like seconds (10 digits); scale to ms.
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return ms;
  }
  return undefined;
}
