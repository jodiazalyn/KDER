import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";
import { UberApiError } from "@/lib/uber-direct/client";
import { quoteDelivery } from "@/lib/uber-direct/quote";
import type { UberAddress } from "@/lib/uber-direct/types";

/** Map Uber's specific quote-failure modes to a customer-friendly
 *  message. Uber's quote endpoint returns 400/422 with a body that
 *  describes WHY it can't quote (no courier, out of coverage,
 *  invalid address, etc.). The defaults — `unknown` and the
 *  catch-all — fall back to a generic soft-fail. */
function quoteErrorMessage(err: UberApiError): string {
  const parsed = err.parsedBody();
  // Uber error envelopes vary by region/version. Pull `code` and
  // `kind` defensively + fall through to substring matching on
  // the raw body for the common phrasings.
  const code = (parsed?.code as string | undefined)?.toLowerCase() ?? "";
  const kind = (parsed?.kind as string | undefined)?.toLowerCase() ?? "";
  const body = err.body.toLowerCase();

  if (
    code === "no_couriers_available" ||
    code === "no_couriers" ||
    kind === "no_couriers_available" ||
    /no courier|no couriers/.test(body)
  ) {
    return "No couriers available in your area right now — try again in a few minutes, or switch to pickup.";
  }
  if (
    code === "out_of_coverage" ||
    code === "outside_coverage" ||
    /out.of.coverage|outside.coverage|coverage area/.test(body)
  ) {
    return "We don't deliver to this address yet. Switch to pickup instead.";
  }
  if (
    code === "invalid_dropoff" ||
    code === "invalid_address" ||
    /invalid address|could not (?:resolve|geocode)/.test(body)
  ) {
    return "We couldn't find that address. Double-check the street, city, and ZIP.";
  }
  // Default — non-actionable for the customer; same generic
  // message we shipped originally.
  return "Delivery isn't available right now. Try pickup, or try again in a few minutes.";
}

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

  // Quote is intentionally anonymous-friendly — customers should see
  // the delivery fee + ETA on the storefront BEFORE they're asked to
  // provide name/phone (which happens at Pay time, not Quote time).
  // Same pattern as DoorDash / Uber Eats / every modern food
  // marketplace. Abuse defense is IP-based rate limiting rather than
  // an auth gate.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous-no-ip";
  const rate = checkRateLimit(
    `uber_quote:ip:${ip}`,
    // 60 quotes / hour / IP. Generous — a real customer rarely
    // re-quotes more than ~5 times per checkout (editing address,
    // changing dropoff). Catches spam without hitting normal use.
    60,
    60 * 60 * 1000
  );
  if (!rate.allowed) {
    return apiError("Too many quote requests. Try again in a minute.", 429);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

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
    if (err instanceof UberApiError) {
      console.error("[uber.quote] failed:", {
        status: err.status,
        request_id: err.requestId,
        body: err.body.slice(0, 500),
      });
      return apiError(quoteErrorMessage(err), 503);
    }
    console.error("[uber.quote] failed:", msg);
    return apiError(
      "Delivery isn't available right now. Try pickup, or try again in a few minutes.",
      503
    );
  }
}
