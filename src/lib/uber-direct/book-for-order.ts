import type { SupabaseClient } from "@supabase/supabase-js";
import { UberApiError } from "./client";
import { createDelivery } from "./create-delivery";
import { quoteDelivery } from "./quote";
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

  // Pickup note the courier reads at the creator's door. Lead with a
  // short order reference + the customer's name so the courier grabs the
  // RIGHT bag when a creator has several orders going out at once, then
  // append the creator's own pickup_instructions. Capped at Uber's
  // 280-char pickup_notes limit.
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const pickupCustomerName = order.member_name?.trim() || "Customer";
  const pickupNotes =
    [
      `KDER order #${orderRef} for ${pickupCustomerName}`,
      pickupListing.pickup_instructions?.trim() || "",
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 280) || undefined;

  // Book the delivery. Two layers of resilience:
  //   - Idempotency: order.id passed as both idempotency_key +
  //     external_id, so concurrent webhook retries return the
  //     same Uber delivery.
  //   - Quote expiry fallback: if the stored uber_quote_id has
  //     expired by the time the webhook fires (rare but possible
  //     if the customer paused on Stripe Checkout), re-quote
  //     server-side using the same dropoff + pickup and retry the
  //     booking WITHOUT a quote_id. Uber uses its current live
  //     quote in that case. We absorb any small fee variance —
  //     usually < $1.
  const bookOnce = (quoteId: string | undefined) =>
    createDelivery({
      orderId: order.id,
      pickup: {
        name: pickupName,
        address: pickupAddress,
        phoneNumber: pickupPhone,
        businessName: creatorMember?.display_name ?? undefined,
        notes: pickupNotes,
      },
      dropoff: {
        name: order.member_name ?? "Customer",
        address: dropoffAddress,
        phoneNumber: dropoffPhone,
      },
      manifestItems,
      quoteId,
    });

  let delivery;
  try {
    delivery = await bookOnce(order.uber_quote_id ?? undefined);
  } catch (err) {
    // Detect "quote expired" by status (400/422) + body text.
    // Uber's exact error code/message isn't documented across
    // every region; the heuristic catches the common phrasings.
    const isQuoteExpired =
      err instanceof UberApiError &&
      (err.status === 400 || err.status === 422) &&
      /expir|invalid_quote/i.test(err.body);

    if (!isQuoteExpired) {
      // Log the full Uber error for observability before
      // re-throwing — Netlify function logs will show the exact
      // status, body, and request_id we can correlate against
      // Uber's dashboard.
      console.error("[uber-book] createDelivery failed (non-retryable)", {
        order_id: order.id,
        status: err instanceof UberApiError ? err.status : null,
        request_id: err instanceof UberApiError ? err.requestId : null,
        body:
          err instanceof UberApiError ? err.body.slice(0, 500) : null,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    console.warn("[uber-book] stored quote expired, re-quoting", {
      order_id: order.id,
      original_quote_id: order.uber_quote_id,
    });
    // Re-quote — pickup + dropoff already in scope.
    const fresh = await quoteDelivery({
      pickup: pickupAddress,
      dropoff: dropoffAddress,
      pickupPhoneNumber: pickupPhone,
      dropoffPhoneNumber: dropoffPhone,
    });
    console.log("[uber-book] re-quote complete", {
      order_id: order.id,
      new_quote_id: fresh.id,
      new_fee_cents: fresh.fee,
      original_fee_cents: order.uber_fee_cents,
    });
    delivery = await bookOnce(fresh.id);
  }

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
      // Clear any prior booking failure — this attempt succeeded, so a
      // stale error from an earlier failed attempt must not linger and
      // keep the confirmation page in its error state.
      uber_booking_error: null,
      uber_booking_failed_at: null,
    })
    .eq("id", order.id);

  // Structured success log — includes the fee Uber actually
  // charged vs what we'd already collected from the customer.
  // A drift here means KDER absorbs or pockets the difference,
  // so surfacing the diff in logs gives us an operational
  // signal if drift becomes systematic.
  const chargedCents = order.uber_fee_cents ?? null;
  const feeDriftCents =
    chargedCents !== null ? delivery.fee - chargedCents : null;
  console.log("[uber-book] success", {
    order_id: orderId,
    uber_delivery_id: delivery.id,
    status: delivery.status,
    fee_charged_cents: chargedCents,
    fee_uber_cents: delivery.fee,
    fee_drift_cents: feeDriftCents,
    tracking_url: delivery.tracking_url,
  });
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
