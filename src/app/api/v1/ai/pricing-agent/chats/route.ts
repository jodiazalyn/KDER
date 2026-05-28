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

/**
 * POST /api/v1/ai/pricing-agent/chats
 *
 * Bulk-import a chat transcript that was accumulated anonymously
 * (in localStorage) before the user signed up. Saves it as a new
 * pricing_chats row so they don't lose the conversation they just
 * had with the coach.
 *
 * Body: { messages: ChatMessage[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

    // Same shape + length validation as the streaming endpoint.
    const messages = rawMessages
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: (m.content as string).slice(0, 8000),
      }))
      .slice(0, 100);

    if (messages.length === 0) {
      return apiError("No valid messages to save.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Sign in to save this chat.", 401);

    // Title = first user message, capped at 40 chars (same as the
    // streaming endpoint's auto-title).
    const firstUser = messages.find(
      (m: { role: string }) => m.role === "user"
    );
    const title = (firstUser?.content ?? "Untitled chat").trim().slice(0, 40);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("pricing_chats")
      .insert({
        member_id: user.id,
        title,
        messages,
      })
      .select("id, title, updated_at")
      .single();

    if (error) {
      console.error("[pricing-agent.chats] import failed:", error.message);
      return apiError("Couldn't save the chat.", 500);
    }

    return apiSuccess({ chat: data });
  } catch (err) {
    console.error("[pricing-agent.chats] POST threw:", err);
    return apiError("Couldn't save the chat.", 500);
  }
}
