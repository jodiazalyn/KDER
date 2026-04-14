import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const { display_name, handle, photo_url, bio, zips } =
      await request.json();

    const trimmedName = display_name?.trim();
    const trimmedHandle = handle?.trim()?.toLowerCase();

    if (!trimmedName || !trimmedHandle) {
      return apiError("Display name and handle are required.", 400);
    }

    if (!/^[a-z0-9_]{3,30}$/.test(trimmedHandle)) {
      return apiError("Invalid handle format.", 400);
    }

    if (!Array.isArray(zips)) {
      return apiError("Zips must be an array.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    // Upsert member record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from("members")
      .upsert(
        {
          id: user.id,
          phone: user.phone || "",
          display_name: trimmedName,
          handle: trimmedHandle,
          photo_url: photo_url?.trim() || null,
          bio: bio?.trim() || null,
          role: "creator",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (memberError) {
      console.error("Member upsert error:", memberError);
      return apiError("Failed to save profile.", 500);
    }

    // Upsert creator record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator, error: creatorError } = await (supabase as any)
      .from("creators")
      .upsert(
        {
          member_id: user.id,
          service_zip_codes: zips || [],
        },
        { onConflict: "member_id" }
      )
      .select("id")
      .single();

    if (creatorError) {
      console.error("Creator upsert error:", creatorError);
      return apiError("Failed to save creator profile.", 500);
    }

    return apiSuccess({
      creator_id: creator?.id || "",
      member_id: user.id,
    });
  } catch (err) {
    console.error("Onboarding error:", err);
    return apiError("Creator onboarding failed", 500);
  }
}
