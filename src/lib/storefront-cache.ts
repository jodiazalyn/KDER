import { revalidateTag } from "next/cache";

/**
 * Edge-cache invalidation for the buyer-facing storefront page.
 *
 * The storefront page (`src/app/[handle]/page.tsx`) wraps its data fetch
 * in `unstable_cache` with a 60-second TTL and a `storefront-<handle>`
 * tag. When a creator publishes, edits, or pauses a plate, we want the
 * change to show up on their public storefront within seconds rather
 * than at the next 60-second boundary — so we explicitly fire the tag
 * here from the listings mutation routes.
 *
 * Falls back gracefully when the handle can't be resolved (mid-onboarding
 * accounts, deleted members, RLS-blocked rows): the cache will still
 * expire on its own within the TTL window.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export async function revalidateStorefrontByCreatorId(
  supabase: SupabaseLike,
  creatorId: string
): Promise<void> {
  try {
    const { data: creator } = await supabase
      .from("creators")
      .select("member_id")
      .eq("id", creatorId)
      .single();

    if (!creator?.member_id) return;

    const { data: member } = await supabase
      .from("members")
      .select("handle")
      .eq("id", creator.member_id)
      .single();

    if (!member?.handle) return;

    revalidateTag(`storefront-${member.handle.toLowerCase()}`);
  } catch (err) {
    // Non-fatal — cache will expire on its own within 60s.
    console.warn("[revalidateStorefrontByCreatorId] failed", err);
  }
}
