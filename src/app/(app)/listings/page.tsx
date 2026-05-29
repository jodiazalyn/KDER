import { requireCreator } from "@/lib/loaders/auth";
import { loadCreatorListings } from "@/lib/loaders/listings";
import { ListingsClient } from "./listings-client";

// Per-creator content, rendered fresh on each visit (the next
// mutation tap triggers router.refresh which re-runs this).
export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const { supabase, creator } = await requireCreator();
  // All statuses — tab counts are computed in the client island
  // off the full list (active / paused / drafts / archived).
  const { data } = await loadCreatorListings(supabase, creator.id);
  return <ListingsClient initialListings={data} />;
}
