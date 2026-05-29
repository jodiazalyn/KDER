import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorBlackout } from "@/types";

/**
 * Load a creator's calendar blackouts (one-off + recurring).
 * Single source of truth — used by both the GET
 * /api/v1/catering/blackouts route and the calendar's Server
 * Component page.
 *
 * Order: blackout_date ascending, NULLs last (so recurring rows
 * — which have no date — sort after the one-off list).
 */
export async function loadCreatorBlackouts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creatorId: string
): Promise<{ data: CreatorBlackout[]; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("creator_blackouts")
    .select("id, creator_id, kind, blackout_date, weekday, reason, created_at")
    .eq("creator_id", creatorId)
    .order("blackout_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[loaders.blackouts] failed:", error.message);
    return { data: [], error: error.message };
  }
  return { data: (data as CreatorBlackout[]) ?? [], error: null };
}
