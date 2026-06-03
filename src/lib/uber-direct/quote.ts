import { uberRequest } from "./client";
import type {
  UberAddress,
  UberQuoteRequest,
  UberQuoteResponse,
} from "./types";

/**
 * Get a delivery quote for a pickup + dropoff pair.
 *
 * Wraps `POST /customers/{customer_id}/delivery_quotes`. Used
 * by the checkout flow to show the customer the exact delivery
 * fee + ETA *before* they pay. The returned `id` (dqt_xxx) is
 * stored on the order so the same quote can be presented at
 * create-delivery time.
 *
 * Quotes expire — usually 5-15 minutes. If the customer takes
 * longer to complete checkout, the create-delivery server-side
 * call will re-quote before charging.
 */
export async function quoteDelivery(args: {
  pickup: UberAddress;
  dropoff: UberAddress;
  pickupPhoneNumber?: string;
  dropoffPhoneNumber?: string;
  manifestTotalValue?: number;
}): Promise<UberQuoteResponse> {
  const body: UberQuoteRequest = {
    pickup_address: JSON.stringify(args.pickup),
    dropoff_address: JSON.stringify(args.dropoff),
    pickup_phone_number: args.pickupPhoneNumber,
    dropoff_phone_number: args.dropoffPhoneNumber,
    manifest_total_value: args.manifestTotalValue,
  };
  return uberRequest<UberQuoteResponse>({
    op: "quote",
    method: "POST",
    path: "/customers/{customer_id}/delivery_quotes",
    body,
  });
}
