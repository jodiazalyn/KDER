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

    const { data, error } = await supabase
      .from("listings")
      .insert({
        ...body,
        creator_id: user.id,
        status: body.status || "draft",
      })
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
