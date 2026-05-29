import { apiSuccess, apiError } from "@/lib/api";
import { loadConversations } from "@/lib/loaders/conversations";

/**
 * GET /api/v1/messages/conversations — grouped thread list for the
 * current user.
 *
 * Returns `{ general: Conversation[], orders: Conversation[] }` —
 * shape preserved from earlier so the inbox client island consumes
 * the same JSON without any changes.
 *
 * The grouping logic lives in `@/lib/loaders/conversations` so the
 * Server Component /messages page can call it directly without a
 * second HTTP hop.
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    const { general, orders, error } = await loadConversations(
      supabase,
      user.id
    );
    if (error) return apiError("Failed to fetch conversations.", 500);
    return apiSuccess({ general, orders });
  } catch {
    return apiError("Failed to fetch conversations.", 500);
  }
}

// Re-export the conversation shape so any callers importing it
// from the old path keep working.
export type { ConversationOut } from "@/lib/loaders/conversations";
