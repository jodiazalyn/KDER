import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/ai/pricing-agent/chats
 *
 * Returns the authenticated user's pricing-coach chat list (id +
 * title + updated_at), most-recently-updated first. Used by the
 * "Past chats" drawer on the /pricing-agent page.
 *
 * Anonymous callers get a 401 — they don't have any saved chats by
 * design (anon chats are ephemeral, in-component-state only).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Sign in to see your saved chats.", 401);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("pricing_chats")
    .select("id, title, updated_at")
    .eq("member_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[pricing-agent.chats] list failed:", error.message);
    return apiError("Couldn't load saved chats.", 500);
  }

  return apiSuccess({ chats: data ?? [] });
}
