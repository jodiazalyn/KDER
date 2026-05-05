import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

// Loose RFC-5322-ish check, deliberately matching the client-side
// validator in src/app/onboarding/profile/page.tsx. SendGrid bounces
// catch real deliverability issues; we just want to keep obvious
// typos out of the database.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const {
      display_name,
      handle,
      photo_url,
      bio,
      email,
      zips,
      pickup_address,
    } = await request.json();

    const trimmedName = display_name?.trim();
    const trimmedHandle = handle?.trim()?.toLowerCase();
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmedName || !trimmedHandle) {
      return apiError("Display name and handle are required.", 400);
    }

    if (!/^[a-z0-9_]{3,30}$/.test(trimmedHandle)) {
      return apiError("Invalid handle format.", 400);
    }

    // Email is required for new creator onboarding — without it we
    // can't deliver the new-order alert. Existing creators (no email
    // on file) can still call this endpoint to update other fields:
    // we accept an empty email and preserve the existing value via
    // upsert if one was already set. Fresh accounts must supply one.
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      return apiError("Invalid email format.", 400);
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

    // Upsert member record. Build the patch dynamically: only set
    // `email` when the caller actually supplied one, so a settings-
    // page save that omits email doesn't accidentally null out an
    // existing value.
    const memberPatch: Record<string, unknown> = {
      id: user.id,
      phone: user.phone || "",
      display_name: trimmedName.replace(/<[^>]*>/g, ""),
      handle: trimmedHandle,
      photo_url: photo_url?.trim()?.startsWith("javascript:") ? null : (photo_url?.trim() || null),
      bio: bio?.trim()?.replace(/<[^>]*>/g, "") || null,
      role: "creator",
      updated_at: new Date().toISOString(),
    };
    if (trimmedEmail) {
      memberPatch.email = trimmedEmail;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from("members")
      .upsert(memberPatch, { onConflict: "id" });

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
          pickup_address: pickup_address?.trim()?.replace(/<[^>]*>/g, "") || null,
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
