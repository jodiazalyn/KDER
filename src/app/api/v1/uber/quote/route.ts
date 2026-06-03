import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api";
import { quoteDelivery } from "@/lib/uber-direct/quote";
import type { UberAddress } from "@/lib/uber-direct/types";

/**
 * POST /api/v1/uber/quote
 *
 * Server-side proxy for Uber Direct quote requests. The
 * checkout sheet calls this when the customer types a delivery
 * address — we never expose Uber's client_secret to the browser.
 *
 * Body:
 *   {
 *     listing_id: string,
 *     dropoff: { street_address, city, state, zip_code },
 *     dropoff_phone?: string,
 *     manifest_total_value?: number  // cents
 *   }
 *
 * Returns:
 *   { quote_id, fee_cents, duration_minutes, expires_at }
 *
 * Auth: requires a signed-in user. Quote is idempotent + safe
 * to call repeatedly during checkout — Uber's 5-15 min expiry
 * is handled at delivery-creation time.
 */

interface QuoteRequest {
  listing_id?: unknown;
  dropoff?: unknown;
  dropoff_phone?: unknown;
  manifest_total_value?: unknown;
}

function parseAddress(raw: unknown): UberAddress | null {
  if (!raw || typeof raw !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = raw as any;
  if (
    typeof a.street_address !== "string" ||
    typeof a.city !== "string" ||
    typeof a.state !== "string" ||
    typeof a.zip_code !== "string"
  ) {
    return null;
  }
  return {
    street_address: [a.street_address.slice(0, 200)],
    city: a.city.slice(0, 80),
    state: a.state.slice(0, 4).toUpperCase(),
    zip_code: a.zip_code.slice(0, 10),
    country: "US",
  };
}

/** Parse the creator's stored pickup address (currently a
 *  single text field) into the structured form Uber expects.
 *  Heuristic — splits on commas. Phase 2 will move creators to
 *  a structured address input. */
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

export async function POST(request: NextRequest) {
  let body: QuoteRequest;
  try {
    body = (await request.json()) as QuoteRequest;
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  if (typeof body.listing_id !== "string" || !body.listing_id) {
    return apiError("listing_id is required.", 400);
  }
  const dropoff = parseAddress(body.dropoff);
  if (!dropoff) {
    return apiError(
      "dropoff must include street_address, city, state, zip_code.",
      400
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in to get a delivery quote.", 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listing } = await (supabase as any)
    .from("listings")
    .select("id, kind, status, fulfillment_type, pickup_address")
    .eq("id", body.listing_id)
    .single();

  if (!listing || listing.status !== "active") {
    return apiError("Listing isn't available for delivery right now.", 404);
  }
  if (listing.kind !== "plate") {
    return apiError("Quotes are only available for plate orders.", 400);
  }
  if (
    listing.fulfillment_type !== "delivery" &&
    listing.fulfillment_type !== "both"
  ) {
    return apiError("This listing doesn't offer delivery.", 400);
  }
  if (!listing.pickup_address) {
    return apiError(
      "Creator hasn't set a pickup address. Try pickup instead.",
      400
    );
  }

  const pickup = parsePickupString(listing.pickup_address);
  if (!pickup) {
    return apiError(
      "Creator's pickup address is malformed — flag this listing.",
      500
    );
  }

  const manifestTotalValue =
    typeof body.manifest_total_value === "number" &&
    body.manifest_total_value > 0
      ? Math.floor(body.manifest_total_value)
      : undefined;

  const dropoffPhone =
    typeof body.dropoff_phone === "string"
      ? body.dropoff_phone.replace(/[^\d+]/g, "")
      : undefined;

  try {
    const quote = await quoteDelivery({
      pickup,
      dropoff,
      dropoffPhoneNumber: dropoffPhone,
      manifestTotalValue: manifestTotalValue,
    });
    return apiSuccess({
      quote_id: quote.id,
      fee_cents: quote.fee,
      currency: quote.currency,
      duration_minutes: quote.duration,
      pickup_duration_minutes: quote.pickup_duration,
      dropoff_eta: quote.dropoff_eta,
      expires_at: quote.expires,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[uber.quote] failed:", msg);
    // Uber returns 422 / 400 for "no courier available." Map to
    // a soft-fail so the checkout can pivot to pickup-only.
    return apiError(
      "Delivery isn't available right now. Try pickup, or try again in a few minutes.",
      503
    );
  }
}
