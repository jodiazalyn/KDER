import { uberRequest } from "./client";
import type {
  UberAddress,
  UberCreateDeliveryRequest,
  UberCreateDeliveryResponse,
  UberManifestItem,
} from "./types";

/**
 * Book a real Uber Direct delivery for an order.
 *
 * Wraps `POST /customers/{customer_id}/deliveries`. Called from
 * the Stripe payment_intent.succeeded webhook so we only book a
 * courier after the customer has paid. The KDER order.id is
 * passed as BOTH `idempotency_key` (Uber returns the existing
 * delivery on retry) AND `external_id` (cross-reference visible
 * in Uber's dashboard + on webhook payloads).
 *
 * Seven body fields are required per Uber's spec:
 *   pickup_name, pickup_address, pickup_phone_number,
 *   dropoff_name, dropoff_address, dropoff_phone_number,
 *   manifest_items
 */
export async function createDelivery(args: {
  /** KDER order id — used for both idempotency + cross-ref. */
  orderId: string;
  pickup: {
    name: string;
    address: UberAddress;
    phoneNumber: string;
    businessName?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  };
  dropoff: {
    name: string;
    address: UberAddress;
    phoneNumber: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  };
  manifestItems: UberManifestItem[];
  quoteId?: string;
}): Promise<UberCreateDeliveryResponse> {
  const body: UberCreateDeliveryRequest = {
    pickup_name: args.pickup.name,
    pickup_address: JSON.stringify(args.pickup.address),
    pickup_phone_number: args.pickup.phoneNumber,
    pickup_business_name: args.pickup.businessName,
    pickup_latitude: args.pickup.latitude,
    pickup_longitude: args.pickup.longitude,
    pickup_notes: args.pickup.notes,

    dropoff_name: args.dropoff.name,
    dropoff_address: JSON.stringify(args.dropoff.address),
    dropoff_phone_number: args.dropoff.phoneNumber,
    dropoff_latitude: args.dropoff.latitude,
    dropoff_longitude: args.dropoff.longitude,
    dropoff_notes: args.dropoff.notes,

    manifest_items: args.manifestItems,

    quote_id: args.quoteId,
    idempotency_key: args.orderId,
    external_id: args.orderId,
  };

  return uberRequest<UberCreateDeliveryResponse>({
    op: "create-delivery",
    method: "POST",
    path: "/customers/{customer_id}/deliveries",
    body,
  });
}
