import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { revalidateStorefrontByCreatorId } from "@/lib/storefront-cache";
import { CATERING_INCLUSION_CATEGORIES } from "@/types";

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
      return apiError("Failed to update listing.", 500);
    }

    // Flush this creator's storefront cache so edits/status changes
    // (publish/pause/archive) appear on /@<handle> immediately.
    await revalidateStorefrontByCreatorId(supabase, creator.id);

    return apiSuccess({ listing: data });
  } catch {
    return apiError("Failed to update listing.", 500);
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
