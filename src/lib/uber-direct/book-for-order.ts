import type { SupabaseClient } from "@supabase/supabase-js";
import { createDelivery } from "./create-delivery";
import type { UberAddress, UberManifestItem } from "./types";

/**
 * Book an Uber Direct delivery for a KDER plate order.
 *
 * Called from the Stripe checkout.session.completed webhook
 * AFTER the order is marked paid. Wraps the raw createDelivery
 * call with the integration logic: load order + creator pickup
 * info, parse stored addresses, build the manifest from
 * order.items, and persist the resulting delivery_id / fee /
 * tracking_url back onto the order row.
 *
 * **Idempotency**:
 *   - If the order's `uber_delivery_id` is already set, we
 *     no-op (Stripe replays the webhook on retries; we already
 *     booked).
 *   - The createDelivery call itself passes order.id as both
 *     idempotency_key + external_id, so even if our no-op check
 *     races with a parallel webhook fire, Uber returns the
 *     same delivery on the second call instead of double-
 *     booking a courier.
 *
 * **Failure modes**:
 *   - Throws on any unexpected error so the caller can log it.
 *     The order stays in a "paid + pending booking" state; a
 *     follow-up cron (Phase 3) sweeps and retries.
 *   - Pickup-only orders short-circuit silently — nothing to do.
 */
export async function bookUberDeliveryForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orderId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderErr } = await (supabase as any)
    .from("orders")
    .select(
      `
      id, fulfillment_type, member_name, member_phone,
      delivery_address, dropoff_address, dropoff_instructions,
      uber_quote_id, uber_delivery_id, uber_fee_cents,
      items, creator_id,
      creator:creators(
        member:members(display_name, phone),
        listings:listings(id, name, pickup_address, pickup_instructions)
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    throw new Error(
      `bookUberDeliveryForOrder: order ${orderId} not found`
    );
  }

  // Pickup-only — nothing to do.
  if (order.fulfillment_type !== "delivery") return;

  // Already booked — idempotent no-op.
  if (order.uber_delivery_id) {
    console.log(
      `[uber-book] order ${orderId} already has delivery ${order.uber_delivery_id} — skipping`
    );
    return;
  }

  // Resolve pickup from the first listing in the order (carts
  // are per-creator, so every listing in this order shares the
  // same pickup_address).
  const firstItem = Array.isArray(order.items) ? order.items[0] : null;
  if (!firstItem?.listing_id) {
    throw new Error(
      `bookUberDeliveryForOrder: order ${orderId} has no items`
    );
  }
  const listings = order.creator?.listings ?? [];
  const pickupListing = listings.find(
    (l: { id: string }) => l.id === firstItem.listing_id
  );
  if (!pickupListing?.pickup_address) {
    throw new Error(
      `bookUberDeliveryForOrder: listing ${firstItem.listing_id} has no pickup_address — can't dispatch`
    );
  }
  const pickupAddress = parsePickupString(pickupListing.pickup_address);
  if (!pickupAddress) {
    throw new Error(
      `bookUberDeliveryForOrder: malformed pickup_address on listing ${firstItem.listing_id}`
    );
  }

  // Resolve dropoff from the order's stored fields. The
  // checkout API stuffed the structured city/state/zip into
  // dropoff_instructions as JSON (no dedicated columns for them
  // in migration 019; we re-use what's there).
  const dropoffStreet = (order.dropoff_address ?? order.delivery_address ?? "").trim();
  if (!dropoffStreet) {
    throw new Error(
      `bookUberDeliveryForOrder: order ${orderId} missing dropoff address`
    );
  }
  let dropoffCity = "Houston";
  let dropoffState = "TX";
  let dropoffZip = "";
  if (typeof order.dropoff_instructions === "string") {
    try {
      const parsed = JSON.parse(order.dropoff_instructions);
      if (parsed?.city) dropoffCity = String(parsed.city).slice(0, 80);
      if (parsed?.state) dropoffState = String(parsed.state).slice(0, 2).toUpperCase();
      if (parsed?.zip_code) dropoffZip = String(parsed.zip_code).slice(0, 10);
    } catch {
      /* not JSON — leave structured defaults */
    }
  }
  if (!dropoffZip) {
    throw new Error(
      `bookUberDeliveryForOrder: order ${orderId} missing dropoff zip`
    );
  }
  const dropoffAddress: UberAddress = {
    street_address: [dropoffStreet],
    city: dropoffCity,
    state: dropoffState,
    zip_code: dropoffZip,
    country: "US",
  };

  // Manifest items — what's in the bag. Uber shows these to the
  // courier, so use the plate name + qty. We default size="small"
  // for single-plate orders; larger orders bump to medium.
  const totalQty = (Array.isArray(order.items) ? order.items : []).reduce(
    (sum: number, it: { quantity?: number }) => sum + (it.quantity ?? 0),
    0
  );
  const defaultSize: UberManifestItem["size"] =
    totalQty >= 5 ? "medium" : "small";
  const manifestItems: UberManifestItem[] = (
    Array.isArray(order.items) ? order.items : []
  ).map((it: {
    name?: string;
    quantity?: number;
    price?: number;
  }) => ({
    name: (it.name ?? "Plate").slice(0, 80),
    quantity: Math.max(1, Math.floor(it.quantity ?? 1)),
    size: defaultSize,
    price: typeof it.price === "number" ? Math.round(it.price * 100) : undefined,
  }));

  const creatorMember = order.creator?.member;
  const pickupName = pickupListing.name ?? "KDER plate";
  const pickupPhone = creatorMember?.phone ?? "+10000000000"; // creator phone is required upstream
  const dropoffPhone = order.member_phone ?? "+10000000000";

  // Book it. Uber returns the existing delivery on retries (we
  // pass orderId as both idempotency_key + external_id) so this
  // is safe to call concurrently with a webhook retry.
  const delivery = await createDelivery({
    orderId: order.id,
    pickup: {
      name: pickupName,
      address: pickupAddress,
      phoneNumber: pickupPhone,
      businessName: creatorMember?.display_name ?? undefined,
      notes: pickupListing.pickup_instructions ?? undefined,
    },
    dropoff: {
      name: order.member_name ?? "Customer",
      address: dropoffAddress,
      phoneNumber: dropoffPhone,
    },
    manifestItems,
    quoteId: order.uber_quote_id ?? undefined,
  });

  // Persist what we got back. The status field is intentionally
  // left for the webhook handler to set — we want a single
  // writer for uber_status so cross-source races can't fight
  // over it. We DO record the tracking URL + delivery id here so
  // the order confirmation page can surface them immediately.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("orders")
    .update({
      uber_delivery_id: delivery.id,
      uber_tracking_url: delivery.tracking_url,
      // Capture the fee Uber actually charged (may differ
      // slightly from the quote if we had to re-quote).
      uber_fee_cents: delivery.fee,
      uber_status: delivery.status,
      uber_status_updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  console.log(
    `[uber-book] order ${orderId} → delivery ${delivery.id} status=${delivery.status}`
  );
}

/** Parse a free-text pickup address into Uber's structured form.
 *  Duplicated from src/app/api/v1/uber/quote/route.ts to keep
 *  this lib self-contained (avoids a route → lib dependency). */
function parsePickupString(text: string): UberAddress | null {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1];
  const stateZip = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(last);
  let state = "";
  let zip = "";
  let cityIdx = parts.length - 1;
  if (stateZip) {
    state = stateZip[1].toUpperCase();
    zip = stateZip[2];
    cityIdx = parts.length - 2;
  } else if (/^[A-Za-z]{2}$/.test(last)) {
    state = last.toUpperCase();
    cityIdx = parts.length - 2;
  } else if (/^\d{5}(?:-\d{4})?$/.test(last)) {
    zip = last;
    const prev = parts[parts.length - 2] ?? "";
    if (/^[A-Za-z]{2}$/.test(prev)) {
      state = prev.toUpperCase();
      cityIdx = parts.length - 3;
    } else {
      cityIdx = parts.length - 2;
    }
  }
  if (cityIdx < 1) return null;
  const city = parts[cityIdx];
  const streetParts = parts.slice(0, cityIdx);
  if (streetParts.length === 0 || !city) return null;
  return {
    street_address: streetParts,
    city,
    state,
    zip_code: zip,
    country: "US",
  };
}
