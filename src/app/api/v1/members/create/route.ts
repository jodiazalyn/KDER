import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/members/create — create or update a customer's members row.
 *
 * Customer signup path. Creates a minimal members row with role='member'
 * (no handle required). Idempotent — callers can retry without duplicating.
 *
 * Creators should continue to use /api/v1/creators/onboard, which sets
 * role='creator' and also creates the creators row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const display_name = String(body?.display_name || "").trim();

    if (!display_name) {
      return apiError("Display name is required.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    // HTML-strip the display name like the onboard route does.
    const cleanName = display_name.replace(/<[^>]*>/g, "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("members")
      .upsert(
        {
          id: user.id,
          phone: user.phone || "",
          display_name: cleanName,
          role: "member",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      return apiError(`Failed to save profile: ${error.message}`, 500);
    }

    return apiSuccess({ member_id: user.id });
  } catch {
    return apiError("Failed to save profile.", 500);
  }
}
