import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { revalidateStorefrontByCreatorId } from "@/lib/storefront-cache";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const mine = request.nextUrl.searchParams.get("mine") === "true";

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let query = supabase.from("listings").select("*");

    if (mine) {
      // Scope to the authenticated creator's listings (all statuses)
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

      query = query.eq("creator_id", creator.id);
      if (status) query = query.eq("status", status);
    } else if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq("status", "active");
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      return apiError("Failed to fetch listings.", 500);
    }

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
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("listings")
      .insert(allowed)
      .select()
      .single();

    if (error) {
      return apiError("Failed to create listing.", 500);
    }

    // Flush this creator's storefront page cache so the new plate appears
    // on /@<handle> immediately rather than at the next 60s boundary.
    if (allowed.status === "active") {
      await revalidateStorefrontByCreatorId(supabase, creator.id);
    }

    return apiSuccess({ listing: data });
  } catch {
    return apiError("Failed to create listing.", 500);
  }
}
