import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "@/types";

/**
 * Load the listings owned by a creator. Single source of truth
 * for the query body — used both by the GET /api/v1/listings
 * route (when ?mine=true) AND by the Server Component pages
 * (/dashboard, /listings) so they don't have to hop through an
 * internal HTTP roundtrip.
 *
 * Options:
 *   - activeOnly: when true, filter to status='active' (the
 *     dashboard's "what's live right now" view).
 *
 * Returns the same shape the API route returns: a plain array of
 * Listing rows. Order: newest first (created_at desc), matching
 * what creators expect to see top-of-list.
 */
export async function loadCreatorListings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creatorId: string,
  opts?: { activeOnly?: boolean }
): Promise<{ data: Listing[]; error: string | null }> {
  let q = supabase
    .from("listings")
    .select("*")
    .eq("creator_id", creatorId);

  if (opts?.activeOnly) {
    q = q.eq("status", "active");
  }

  const { data, error } = await q.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("[loaders.listings] failed:", error.message);
    return { data: [], error: error.message };
  }
  return { data: (data as Listing[]) ?? [], error: null };
}
