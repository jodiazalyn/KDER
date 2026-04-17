import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");

    // Demo mode — listings managed client-side via localStorage
    if (isDemoMode()) {
      return apiSuccess({ listings: [], demo: true });
    }

    // Production: fetch from Supabase
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let query = supabase.from("listings").select("*");

    if (status) {
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

    if (!body.name || !body.price || !body.quantity) {
      return apiError("Name, price, and quantity are required.", 400);
    }

    // Demo mode — listings managed client-side
    if (isDemoMode()) {
      return apiSuccess({ listing: body, demo: true });
    }

    // Production: insert to Supabase
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Look up the creator row linked to this auth user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single() as { data: { id: string } | null };

    if (!creator) return apiError("Creator profile not found.", 404);

    // Normalize photo: accept single photo_url or photos[] array, store as photos[]
    const photos: string[] = Array.isArray(body.photos)
      ? body.photos.filter((p: unknown) => typeof p === "string")
      : body.photo_url
        ? [body.photo_url]
        : [];

    // Whitelist allowed fields — prevent mass assignment
    // Column names must match schema.sql exactly
    const allowed = {
      name: body.name,
      description: body.description || "",
      price: Number(body.price),
      quantity: Number(body.quantity),
      category_tags: Array.isArray(body.category_tags) ? body.category_tags : [],
      allergens: Array.isArray(body.allergen_flags)
        ? body.allergen_flags
        : Array.isArray(body.allergens)
          ? body.allergens
          : [],
      fulfillment_type: body.fulfillment_type || "pickup",
      photos,
      min_order: body.min_order_amount
        ? Number(body.min_order_amount)
        : body.min_order
          ? Number(body.min_order)
          : null,
      creator_id: creator.id,
      status: body.status === "active" ? "active" : "draft",
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

    return apiSuccess({ listing: data });
  } catch {
    return apiError("Failed to create listing.", 500);
  }
}
