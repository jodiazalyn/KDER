import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { revalidateStorefrontByCreatorId } from "@/lib/storefront-cache";
import { CATERING_INCLUSION_CATEGORIES } from "@/types";

/** Sanitize an `extras` payload (migration 018). Plate-only optional
 *  add-ons offered at checkout. Reject anything that isn't an array;
 *  per item: name = non-empty string trimmed to 60 chars; price_cents
 *  = non-negative integer. Dedup by case-insensitive name (first
 *  occurrence wins). Caps at 20 entries so a runaway client can't
 *  store unbounded JSON. */
function sanitizeExtras(
  raw: unknown
): Array<{ name: string; price_cents: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ name: string; price_cents: number }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = item as any;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const price_cents = Math.max(0, Math.floor(Number(r.price_cents) || 0));
    out.push({ name, price_cents });
    if (out.length >= 20) break;
  }
  return out;
}

/** Sanitize a catering_inclusion_groups payload: drop unknown keys,
 *  drop non-string items, cap each item at 60 chars. Never trust the
 *  shape of incoming JSONB. */
function sanitizeInclusionGroups(
  raw: unknown
): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowedKeys = new Set<string>(CATERING_INCLUSION_CATEGORIES);
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) continue;
    if (!Array.isArray(value)) continue;
    const items = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().slice(0, 60))
      .filter((v) => v.length > 0);
    if (items.length > 0) out[key] = items;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const mine = request.nextUrl.searchParams.get("mine") === "true";

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    if (mine) {
      // Scope to the authenticated creator's listings. Delegates
      // to the shared loader so the /listings + /dashboard
      // Server Component pages use the exact same query body
      // and we don't drift the two surfaces.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return apiError("Unauthorized.", 401);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: creator } = await (supabase as any)
        .from("creators")
        .select("id")
        .eq("member_id", user.id)
        .single() as { data: { id: string } | null };

      if (!creator) return apiSuccess({ listings: [] });

      const { loadCreatorListings } = await import("@/lib/loaders/listings");
      const { data, error } = await loadCreatorListings(
        supabase,
        creator.id,
        { activeOnly: status === "active" }
      );
      if (error) return apiError("Failed to fetch listings.", 500);
      // If a non-active status was requested, filter client-side
      // (single-status filtering); the loader covers the
      // activeOnly fast path so the common case stays as one
      // indexed query.
      const filtered =
        status && status !== "active"
          ? data.filter((l) => l.status === status)
          : data;
      return apiSuccess({ listings: filtered });
    }

    // Public path — used by discovery surfaces. No auth scope.
    let query = supabase.from("listings").select("*");
    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq("status", "active");
    }
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) return apiError("Failed to fetch listings.", 500);
    return apiSuccess({ listings: data });
  } catch {
    return apiError("Failed to fetch listings.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Plate listings need name + price + quantity. Catering listings
    // need name + price + min_guests + lead_time + at least one
    // fulfillment option. We let the DB CHECK constraint
    // (listings_catering_required_fields) be the final enforcer; this
    // is a fast-fail validation for nicer client errors.
    if (!body.name || !body.price) {
      return apiError("Name and price are required.", 400);
    }
    const kind = body.kind === "catering" ? "catering" : "plate";
    if (kind === "plate" && !body.quantity) {
      return apiError("Quantity is required for plates.", 400);
    }
    if (kind === "catering") {
      if (!body.catering_min_guests || !body.catering_lead_time_hours) {
        return apiError(
          "Min guests and lead time are required for catering listings.",
          400
        );
      }
      if (
        !Array.isArray(body.catering_fulfillment) ||
        body.catering_fulfillment.length === 0
      ) {
        return apiError(
          "Pick at least one fulfillment option (pickup/delivery/onsite).",
          400
        );
      }
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Look up the creator row linked to this auth user.
    // We also pull kyc_status so we can gate activation on Stripe Connect being done.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id, kyc_status")
      .eq("member_id", user.id)
      .single() as { data: { id: string; kyc_status: string | null } | null };

    if (!creator) return apiError("Creator profile not found.", 404);

    // Connect KYC gate: only verified creators can create an ACTIVE plate.
    // Drafts, paused, archived are fine for everyone.
    if (body.status === "active" && creator.kyc_status !== "verified") {
      return apiError(
        "Complete Stripe Connect setup before activating plates.",
        403
      );
    }

    // Uber Direct activation gate (migration 019): a plate
    // listing offering delivery can't go active without a
    // pickup address — without one we can't dispatch a courier
    // when an order comes in. Drafts are fine; only block on
    // status=active.
    if (
      body.status === "active" &&
      body.kind === "plate" &&
      (body.fulfillment_type === "delivery" ||
        body.fulfillment_type === "both") &&
      (typeof body.pickup_address !== "string" ||
        !body.pickup_address.trim())
    ) {
      return apiError(
        "Add a pickup address for delivery orders before publishing.",
        400
      );
    }

    // Normalize photo: accept single photo_url or photos[] array, store as photos[]
    const photos: string[] = Array.isArray(body.photos)
      ? body.photos.filter((p: unknown) => typeof p === "string")
      : body.photo_url
        ? [body.photo_url]
        : [];

    // Whitelist allowed fields — prevent mass assignment
    // Column names must match schema.sql exactly
    const allowed = {
      kind,
      name: body.name,
      description: body.description || "",
      price: Number(body.price),
      // Catering listings store 1 in quantity (the column is NOT NULL,
      // but the concept doesn't apply per-event).
      quantity: kind === "catering" ? 1 : Number(body.quantity),
      category_tags: Array.isArray(body.category_tags) ? body.category_tags : [],
      allergens: Array.isArray(body.allergen_flags)
        ? body.allergen_flags
        : Array.isArray(body.allergens)
          ? body.allergens
          : [],
      fulfillment_type: body.fulfillment_type || "pickup",
      photos,
      video: typeof body.video === "string" ? body.video : null,
      min_order: body.min_order_amount
        ? Number(body.min_order_amount)
        : body.min_order
          ? Number(body.min_order)
          : null,
      creator_id: creator.id,
      status: body.status === "active" ? "active" : "draft",
      // Catering-only fields. The DB CHECK enforces these are non-null
      // when kind='catering'; for plates we explicitly write null so
      // the row is clean.
      catering_pricing_mode:
        kind === "catering"
          ? body.catering_pricing_mode === "flat"
            ? "flat"
            : "per_head"
          : null,
      catering_min_guests:
        kind === "catering" ? Number(body.catering_min_guests) : null,
      catering_max_guests:
        kind === "catering" && body.catering_max_guests
          ? Number(body.catering_max_guests)
          : null,
      catering_lead_time_hours:
        kind === "catering" ? Number(body.catering_lead_time_hours) : null,
      catering_fulfillment:
        kind === "catering"
          ? (body.catering_fulfillment as string[]).filter((v) =>
              ["pickup", "delivery", "onsite"].includes(v)
            )
          : [],
      catering_inclusions:
        kind === "catering" && typeof body.catering_inclusions === "string"
          ? body.catering_inclusions.trim() || null
          : null,
      // Structured menu groups. Sanitized to prevent arbitrary JSON
      // injection — only string keys with string-array values pass through.
      catering_inclusion_groups:
        kind === "catering"
          ? sanitizeInclusionGroups(body.catering_inclusion_groups)
          : {},
      // Plate-only pre-order date (migration 017). Only accept a
      // YYYY-MM-DD string; anything else lands as NULL = instant.
      // Catering listings always get NULL (they use the inquiry's
      // event_date instead).
      pre_order_available_date:
        kind === "plate" &&
        typeof body.pre_order_available_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(body.pre_order_available_date)
          ? body.pre_order_available_date
          : null,
      // Plate-only extras (migration 018). Catering always empty.
      extras: kind === "plate" ? sanitizeExtras(body.extras) : [],
      // Uber Direct pickup address (migration 019). Plate-only;
      // catering uses its own pickup model via the inquiry/
      // booking flow. Stored as free text — Uber server-side-
      // geocodes at quote time. Capped at 200 chars to match
      // the form input cap.
      pickup_address:
        kind === "plate" &&
        typeof body.pickup_address === "string" &&
        body.pickup_address.trim().length > 0
          ? body.pickup_address.trim().slice(0, 200)
          : null,
      pickup_instructions:
        kind === "plate" &&
        typeof body.pickup_instructions === "string" &&
        body.pickup_instructions.trim().length > 0
          ? body.pickup_instructions.trim().slice(0, 280)
          : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("listings")
      .insert(allowed)
      .select()
      .single();

    if (error) {
      // Same diagnostics pattern as the PATCH route — surface the
      // actual DB error so a missing migration column or CHECK
      // constraint shows up in the toast + Netlify logs instead of
      // collapsing into a generic 500.
      console.error("[listings.POST] insert failed:", {
        creator_id: creator.id,
        keys_sent: Object.keys(allowed),
        error_message: error.message,
        error_code: (error as { code?: string }).code,
        error_details: (error as { details?: string }).details,
      });
      return apiError(`Failed to create listing: ${error.message}`, 500);
    }

    // Flush this creator's storefront page cache so the new plate appears
    // on /@<handle> immediately rather than at the next 60s boundary.
    if (allowed.status === "active") {
      await revalidateStorefrontByCreatorId(supabase, creator.id);
    }

    return apiSuccess({ listing: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[listings.POST] threw:", msg);
    return apiError(`Failed to create listing: ${msg}`, 500);
  }
}
