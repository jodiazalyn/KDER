import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight count of a creator's open inquiries — used by the
 * calendar page to hydrate the "X open" badge without fetching
 * the full inquiry list. Cheaper than `loadCreatorInquiries`
 * which pulls every row.
 */
export async function loadOpenInquiryCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creatorId: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("catering_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "open");

  if (error) {
    console.error("[loaders.inquiries] count failed:", error.message);
    return 0;
  }
  return typeof count === "number" ? count : 0;
}
