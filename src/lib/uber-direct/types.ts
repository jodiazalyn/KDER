/**
 * Hand-typed surface for the Uber Direct endpoints we use.
 *
 * Uber doesn't ship a TypeScript SDK; the canonical reference
 * is their OpenAPI 3.0.3 spec (downloadable from the Direct
 * dashboard). These types cover the fields we actually
 * read/write — not the full spec. When we need more
 * (proof-of-delivery, return flow), extend here.
 */

// ── Address ──────────────────────────────────────────────────
// Uber accepts addresses as JSON-stringified objects. We
// construct the object in code, JSON.stringify before sending.
export interface UberAddress {
  street_address: string[]; // line 1, line 2 (rare)
  city: string;
  state: string; // two-letter US state code (e.g. "TX")
  zip_code: string;
  country?: string; // "US" default
}

// ── Manifest item (what's in the bag) ────────────────────────
export interface UberManifestItem {
  /** Display name shown to the courier. */
  name: string;
  /** Plate × qty etc. */
  quantity: number;
  /** Uber's volumetric category. "small" covers most plate
   *  orders (single plate, drink). Bump to "medium" for larger
   *  catering-like bundles. */
  size: "small" | "medium" | "large" | "xlarge" | "big";
  /** Optional itemized price (cents). Not required but nice for
   *  Uber's analytics + courier verification. */
  price?: number;
}

// ── Quote ────────────────────────────────────────────────────
export interface UberQuoteRequest {
  pickup_address: string; // JSON.stringified UberAddress
  dropoff_address: string; // JSON.stringified UberAddress
  pickup_phone_number?: string; // E.164
  dropoff_phone_number?: string; // E.164
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  pickup_ready_dt?: string; // RFC 3339
  pickup_deadline_dt?: string;
  dropoff_ready_dt?: string;
  dropoff_deadline_dt?: string;
  manifest_total_value?: number; // cents
}

export interface UberQuoteResponse {
  kind: "delivery_quote";
  id: string; // dqt_xxxxx
  created: string; // RFC 3339
  expires: string; // RFC 3339
  fee: number; // cents — what the customer pays for delivery
  currency: string; // "usd"
  currency_type: string; // "USD"
  /** Estimated minutes from quote acceptance to dropoff. */
  duration: number;
  /** Estimated minutes until a courier arrives at pickup. */
  pickup_duration: number;
  dropoff_eta: string; // RFC 3339
  dropoff_deadline: string;
}

// ── Create delivery ──────────────────────────────────────────
export interface UberCreateDeliveryRequest {
  // Pickup — all three required
  pickup_name: string;
  pickup_address: string; // JSON.stringified UberAddress
  pickup_phone_number: string; // E.164
  pickup_business_name?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_notes?: string; // ≤280 chars

  // Dropoff — all three required
  dropoff_name: string;
  dropoff_address: string; // JSON.stringified UberAddress
  dropoff_phone_number: string; // E.164
  dropoff_business_name?: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  dropoff_notes?: string;

  // Manifest — at least one item required
  manifest_items: UberManifestItem[];
  manifest_reference?: string;
  manifest_total_value?: number;

  /** Re-use the quote the customer accepted at checkout. Required
   *  to keep the fee Uber returns matching what we charged. */
  quote_id?: string;

  /** Dedup key — same key → same delivery, no double-book. We
   *  set this to the KDER order.id. */
  idempotency_key?: string;

  /** Cross-reference field shown in Uber dashboard + webhooks.
   *  We also set this to the KDER order.id so we can map back
   *  from any Uber-side surface. */
  external_id?: string;

  pickup_ready_dt?: string;
  pickup_deadline_dt?: string;
  dropoff_ready_dt?: string;
  dropoff_deadline_dt?: string;

  /** Cents — tip routed to the courier. v1: always 0. */
  tip?: number;
}

export type UberDeliveryStatus =
  | "pending"
  | "pickup"
  | "pickup_complete"
  | "dropoff"
  | "delivered"
  | "canceled"
  | "returned";

export interface UberCreateDeliveryResponse {
  id: string; // del_xxxxx
  quote_id?: string;
  status: UberDeliveryStatus;
  fee: number; // cents
  /** Customer-facing live tracking page (web). */
  tracking_url: string;
  created: string;
  updated: string;
  live_mode: boolean;
  external_id?: string;
  pickup_eta?: string;
  pickup_ready?: string;
  pickup_deadline?: string;
  dropoff_eta?: string;
  dropoff_ready?: string;
  dropoff_deadline?: string;
  pickup?: unknown;
  dropoff?: unknown;
  courier?: unknown;
  manifest?: unknown;
  manifest_items?: unknown;
  related_deliveries?: unknown;
  undeliverable_reason?: string;
  complete?: boolean;
  courier_imminent?: boolean;
}

// ── Webhook envelope (placeholder — verify against Uber's
//    webhooks doc when sandbox is connected, then tighten) ────
export interface UberWebhookEnvelope {
  kind: string;
  event_id?: string;
  event_time?: string;
  delivery_id?: string;
  data?: {
    id?: string;
    status?: UberDeliveryStatus;
    external_id?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
