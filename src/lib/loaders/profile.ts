import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import type { CreatorProfile } from "@/lib/creator-store";

/**
 * Server-side equivalent of `getCreatorProfileAsync` from
 * `creator-store.ts`. The client-store version falls back to
 * sessionStorage in demo mode, which doesn't make sense on the
 * server — here we just return a permissive default if the rows
 * aren't there.
 *
 * Used by the dashboard Server Component to hydrate
 * `<DashboardClient>` with the creator's profile without a
 * client roundtrip.
 */
export async function loadCreatorProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<CreatorProfile> {
  // members + creators are independent rows — fetch in parallel.
  const [memberRes, creatorRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("members")
      .select(
        "display_name, handle, photo_url, bio, email, instagram_handle, tiktok_handle, website_url, facebook_handle, whatsapp_number"
      )
      .eq("id", userId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("creators")
      .select(
        "service_zip_codes, storefront_active, vibe_score, review_rating_avg, review_count, pickup_address"
      )
      .eq("member_id", userId)
      .single(),
  ]);

  const member = memberRes.data;
  const creator = creatorRes.data;
  const zips: string[] = creator?.service_zip_codes || [];
  const neighborhoods = zips
    .map((zip) => {
      const row = resolveZipToNeighborhood(zip);
      return row ? { name: row.neighborhood, zip } : null;
    })
    .filter((n): n is { name: string; zip: string } => n !== null);

  return {
    display_name: member?.display_name || "Creator",
    bio: member?.bio || null,
    photo_url: member?.photo_url || null,
    handle: member?.handle || "mystore",
    member_id: userId,
    email: member?.email || null,
    neighborhoods,
    storefront_active: creator?.storefront_active ?? true,
    vibe_score:
      typeof creator?.vibe_score === "number"
        ? creator.vibe_score
        : creator?.vibe_score
          ? Number(creator.vibe_score)
          : null,
    review_rating_avg:
      creator?.review_rating_avg != null
        ? Number(creator.review_rating_avg)
        : null,
    review_count: creator?.review_count ?? 0,
    total_orders: 0,
    total_plates: 0,
    pickup_address: creator?.pickup_address || null,
    instagram_handle: member?.instagram_handle || null,
    tiktok_handle: member?.tiktok_handle || null,
    website_url: member?.website_url || null,
    facebook_handle: member?.facebook_handle || null,
    whatsapp_number: member?.whatsapp_number || null,
  };
}
