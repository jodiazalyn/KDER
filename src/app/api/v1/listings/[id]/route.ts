import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { revalidateStorefrontByCreatorId } from "@/lib/storefront-cache";
import { CATERING_INCLUSION_CATEGORIES } from "@/types";

/** Same shape as the POST route's helper for extras (migration 018).
 *  Duplicated rather than reexported to keep route handlers
 *  self-contained. */
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

/** Same shape as the POST route's helper — duplicated rather than
 *  reexported to keep these route handlers self-contained. */
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

/**
 * GET /api/v1/listings/:id — fetch a single listing.
 * Returns the listing if:
 *   (a) its status is "active" (public read), OR
 *   (b) the authenticated user is the owning creator (RLS handles this).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return apiError("Listing not found.", 404);
    }

    return apiSuccess({ listing: data });
  } catch {
    return apiError("Failed to fetch listing.", 500);
  }
}

/**
 * PATCH /api/v1/listings/:id — update a listing (edits + status changes).
 * Only the owning creator can update; RLS enforces this but we also
 * double-check in the WHERE clause as belt-and-suspenders.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id, kyc_status")
      .eq("member_id", user.id)
      .single() as { data: { id: string; kyc_status: string | null } | null };

    if (!creator) return apiError("Creator profile not found.", 404);

    // Connect KYC gate: only verified creators can set a listing to ACTIVE.
    // Transitions back to draft/paused/archived are always allowed.
    if (body.status === "active" && creator.kyc_status !== "verified") {
      return apiError(
        "Complete Stripe Connect setup before activating plates.",
        403
      );
    }

    // Whitelist allowed update fields. Never let clients change creator_id,
    // id, timestamps, or order_count.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowed: Record<string, any> = {};
    if (typeof body.name === "string") allowed.name = body.name;
    if (typeof body.description === "string") allowed.description = body.description;
    if (body.price !== undefined) allowed.price = Number(body.price);
    if (body.quantity !== undefined) allowed.quantity = Number(body.quantity);
    if (Array.isArray(body.category_tags)) allowed.category_tags = body.category_tags;
    if (Array.isArray(body.allergens)) allowed.allergens = body.allergens;
    if (Array.isArray(body.allergen_flags)) allowed.allergens = body.allergen_flags;
    if (typeof body.fulfillment_type === "string") allowed.fulfillment_type = body.fulfillment_type;
    if (Array.isArray(body.photos)) {
      allowed.photos = body.photos.filter((p: unknown) => typeof p === "string");
    }
    if (body.min_order !== undefined) {
      allowed.min_order = body.min_order === null ? null : Number(body.min_order);
    }
    if (body.min_order_amount !== undefined) {
      allowed.min_order = body.min_order_amount === null ? null : Number(body.min_order_amount);
    }
    if (typeof body.status === "string" &&
        ["active", "draft", "paused", "archived"].includes(body.status)) {
      allowed.status = body.status;
    }
    if (body.video !== undefined) allowed.video = body.video;

    // Catering fields — only assigned if the request explicitly sends them.
    // Note: `kind` is intentionally not editable. Switching a listing from
    // plate ↔ catering after creation would orphan inquiries / quotes /
    // bookings, so creators must archive and recreate instead.
    if (
      body.catering_pricing_mode === "per_head" ||
      body.catering_pricing_mode === "flat" ||
      body.catering_pricing_mode === null
    ) {
      allowed.catering_pricing_mode = body.catering_pricing_mode;
    }
    if (body.catering_min_guests !== undefined) {
      allowed.catering_min_guests =
        body.catering_min_guests === null ? null : Number(body.catering_min_guests);
    }
    if (body.catering_max_guests !== undefined) {
      allowed.catering_max_guests =
        body.catering_max_guests === null ? null : Number(body.catering_max_guests);
    }
    if (body.catering_lead_time_hours !== undefined) {
      allowed.catering_lead_time_hours =
        body.catering_lead_time_hours === null
          ? null
          : Number(body.catering_lead_time_hours);
    }
    if (Array.isArray(body.catering_fulfillment)) {
      allowed.catering_fulfillment = body.catering_fulfillment.filter(
        (v: unknown) =>
          typeof v === "string" && ["pickup", "delivery", "onsite"].includes(v)
      );
    }
    if (body.catering_inclusions !== undefined) {
      allowed.catering_inclusions =
        typeof body.catering_inclusions === "string"
          ? body.catering_inclusions.trim() || null
          : null;
    }
    if (body.catering_inclusion_groups !== undefined) {
      allowed.catering_inclusion_groups = sanitizeInclusionGroups(
        body.catering_inclusion_groups
      );
    }
    // Pre-order date (migration 017). Accept null (creator switched
    // back to instant) or a YYYY-MM-DD string. Reject anything else
    // by treating it as undefined (no change).
    if (body.pre_order_available_date !== undefined) {
      if (body.pre_order_available_date === null) {
        allowed.pre_order_available_date = null;
      } else if (
        typeof body.pre_order_available_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(body.pre_order_available_date)
      ) {
        allowed.pre_order_available_date = body.pre_order_available_date;
      }
    }
    // Extras (migration 018). Always sanitize through the helper so
    // a malformed payload becomes [] rather than poisoning the row.
    if (body.extras !== undefined) {
      allowed.extras = sanitizeExtras(body.extras);
    }
    // Pickup address (migration 019). Free text capped at the
    // form limit; explicit null clears any prior value if the
    // creator switched fulfillment back to pickup-only.
    if (body.pickup_address !== undefined) {
      allowed.pickup_address =
        typeof body.pickup_address === "string" &&
        body.pickup_address.trim().length > 0
          ? body.pickup_address.trim().slice(0, 200)
          : null;
    }
    if (body.pickup_instructions !== undefined) {
      allowed.pickup_instructions =
        typeof body.pickup_instructions === "string" &&
        body.pickup_instructions.trim().length > 0
          ? body.pickup_instructions.trim().slice(0, 280)
          : null;
    }

    // Uber Direct activation gate: a delivery-eligible plate
    // being transitioned to ACTIVE must have a pickup address.
    // Only check on status=active transitions; pause/archive
    // doesn't need it. We use the merged shape (current patch +
    // submitted patch) so a creator can patch fulfillment
    // + pickup_address in either order.
    const willBeActive = allowed.status === "active";
    const willOfferDelivery =
      typeof allowed.fulfillment_type === "string"
        ? allowed.fulfillment_type === "delivery" ||
          allowed.fulfillment_type === "both"
        : null;
    if (willBeActive && willOfferDelivery) {
      const addrAfterPatch =
        typeof allowed.pickup_address !== "undefined"
          ? allowed.pickup_address
          : undefined;
      if (
        addrAfterPatch === null ||
        (typeof addrAfterPatch === "string" && !addrAfterPatch.trim())
      ) {
        return apiError(
          "Add a pickup address for delivery orders before publishing.",
          400
        );
      }
      // addrAfterPatch === undefined → falling back to whatever is
      // already on the row. Phase 2 will tighten this with a
      // pre-update SELECT to enforce against the current row;
      // for now we trust the form's client-side guard to fire.
    }

    // Pre-order × delivery mutual exclusion (Uber Direct v1).
    // Only checks when BOTH fields are present in this patch —
    // a creator can switch one then the other across two
    // requests. The combined-shape enforcement on the row
    // itself happens at the form layer.
    if (
      willOfferDelivery &&
      typeof allowed.pre_order_available_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(allowed.pre_order_available_date)
    ) {
      return apiError(
        "Pre-order plates are pickup-only for now.",
        400
      );
    }

    allowed.updated_at = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("listings")
      .update(allowed)
      .eq("id", id)
      .eq("creator_id", creator.id)
      .select()
      .single();

    if (error || !data) {
      // Surface the real DB error to both Netlify logs and the API
      // response. The toast on the form just said "Failed to update
      // listing." for ages, which made every failure look the same —
      // a missing migration column, a CHECK constraint, an RLS
      // denial all collapsed into one opaque message. Logging the
      // error message + code + the keys we tried to write makes
      // future regressions diagnosable from the browser network
      // tab without server access.
      console.error("[listings.PATCH] update failed:", {
        id,
        creator_id: creator.id,
        keys_sent: Object.keys(allowed),
        error_message: error?.message,
        error_code: (error as { code?: string } | null)?.code,
        error_details: (error as { details?: string } | null)?.details,
      });
      const detail = error?.message
        ? `Failed to update listing: ${error.message}`
        : "Failed to update listing (no row returned).";
      return apiError(detail, 500);
    }

    // Flush this creator's storefront cache so edits/status changes
    // (publish/pause/archive) appear on /@<handle> immediately.
    await revalidateStorefrontByCreatorId(supabase, creator.id);

    return apiSuccess({ listing: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[listings.PATCH] threw:", msg);
    return apiError(`Failed to update listing: ${msg}`, 500);
  }
}

/**
 * DELETE /api/v1/listings/:id — archive a listing.
 * We soft-delete (status = 'archived') rather than hard-deleting
 * to preserve order history references.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

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

    if (!creator) return apiError("Creator profile not found.", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("listings")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("creator_id", creator.id);

    if (error) {
      return apiError("Failed to archive listing.", 500);
    }

    // Drop the archived plate from the public storefront immediately.
    await revalidateStorefrontByCreatorId(supabase, creator.id);

    return apiSuccess({ id, status: "archived" });
  } catch {
    return apiError("Failed to archive listing.", 500);
  }
}
