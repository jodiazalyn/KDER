import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/ai/pricing-agent/chats/:id
 *
 * Returns the full transcript of a saved pricing-coach chat. RLS on
 * pricing_chats already enforces that only the owning member can
 * read — we just return 404 on miss so the route doesn't leak ids.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Sign in to load saved chats.", 401);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chat } = await (supabase as any)
    .from("pricing_chats")
    .select("id, title, messages, created_at, updated_at")
    .eq("id", id)
    .single();

  if (!chat) return apiError("Chat not found.", 404);

  return apiSuccess({ chat });
}
