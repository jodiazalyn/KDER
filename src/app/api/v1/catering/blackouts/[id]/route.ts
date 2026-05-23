import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * DELETE /api/v1/catering/blackouts/:id
 * Removes a blackout. RLS scopes to creator-owned rows so an attacker
 * can't delete other creators' blackouts even with a guessed UUID.
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
      .from("creator_blackouts")
      .delete()
      .eq("id", id)
      .eq("creator_id", creator.id);

    if (error) {
      console.error("[blackouts] delete failed:", error.message);
      return apiError("Failed to remove blackout.", 500);
    }

    return apiSuccess({ deleted: id });
  } catch {
    return apiError("Failed to remove blackout.", 500);
  }
}
