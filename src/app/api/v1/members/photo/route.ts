import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { photo_url } = body;

    if (typeof photo_url !== "string" || !photo_url.startsWith("https://")) {
      return apiError("Invalid photo_url.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("members")
      .update({ photo_url })
      .eq("id", user.id);

    if (error) {
      console.error("[members/photo] Failed to update photo_url:", error.message);
      return apiError("Failed to save photo.", 500);
    }

    return apiSuccess({ photo_url });
  } catch {
    return apiError("Failed to save photo.", 500);
  }
}
