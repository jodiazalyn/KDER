import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { StorefrontClient } from "./storefront-client";
import { createClient } from "@/lib/supabase/server";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import type { CreatorProfile } from "@/lib/creator-store";
import type { Listing } from "@/types";
import type { ActiveOrderSummary } from "@/components/storefront/ActiveOrderBanner";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
}

/** ISR-equivalent: cache storefront data at the edge for 60 seconds.
 *  Cache is keyed per-handle and tagged so plate mutations can flush
 *  it instantly via revalidateTag(`storefront-${handle}`). */
const STOREFRONT_CACHE_TTL_SECONDS = 60;

/** Public Supabase client — no cookies, RLS-anon access only. We use this
 *  inside `unstable_cache` because the cookie-binding variant (`createClient`
 *  from `@/lib/supabase/server`) reads dynamic state, which Next forbids
 *  inside a cached scope. The buyer storefront query reads only public
 *  rows (active listings, public member fields), so anon access is enough. */
function createPublicSupabaseClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

interface MemberRow {
  id: string;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  handle: string;
}

interface CreatorRow {
  id: string;
  storefront_active: boolean | null;
  service_zip_codes: string[] | null;
  vibe_score: number | string | null;
}

function resolveZips(zips: string[]) {
  const resolved: { name: string; zip: string }[] = [];
  for (const zip of zips) {
    const match = resolveZipToNeighborhood(zip);
    if (match) resolved.push({ name: match.neighborhood, zip });
  }
  return resolved;
}

async function loadStorefrontUncached(handle: string): Promise<{
  creator: CreatorProfile | null;
  listings: Listing[];
}> {
  // Public client — no cookies, no per-user state. The buyer storefront
  // is the same for every visitor, so caching this read is safe.
  const supabase = createPublicSupabaseClient();

  // First query MUST run alone — every downstream query needs member.id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = (await (supabase as any)
    .from("members")
    .select("id, display_name, bio, photo_url, handle")
    .eq("handle", handle)
    .single()) as { data: MemberRow | null };

  if (!member) {
    return { creator: null, listings: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creatorRow } = (await (supabase as any)
    .from("creators")
    .select("id, storefront_active, service_zip_codes, vibe_score")
    .eq("member_id", member.id)
    .single()) as { data: CreatorRow | null };

  // A member without a creator row is not a sellable storefront.
  if (!creatorRow) {
    return { creator: null, listings: [] };
  }

  // Listings + completed-orders count are independent of each other and
  // both depend only on creatorRow.id — run them in parallel. Saves
  // ~150-300ms per uncached storefront visit.
  const [listingsRes, ordersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("listings")
      .select("*")
      .eq("creator_id", creatorRow.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }) as Promise<{
      data: Listing[] | null;
    }>,
    // Scoped to status='completed' so cancelled/declined/in-progress orders
    // don't inflate the "Orders" figure on the IG-style stats header.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", creatorRow.id)
      .eq("status", "completed") as Promise<{ count: number | null }>,
  ]);

  const listings = listingsRes.data ?? [];
  const completedOrdersCount = ordersRes.count;

  const creator: CreatorProfile = {
    display_name: member.display_name || "Creator",
    bio: member.bio,
    photo_url: member.photo_url,
    handle: member.handle,
    creator_id: creatorRow.id,
    member_id: member.id,
    neighborhoods: resolveZips(creatorRow.service_zip_codes ?? []),
    storefront_active: creatorRow.storefront_active ?? true,
    vibe_score:
      creatorRow.vibe_score !== null && creatorRow.vibe_score !== undefined
        ? Number(creatorRow.vibe_score)
        : null,
    total_orders: completedOrdersCount ?? 0,
    total_plates: listings.length,
    pickup_address: null,
  };

  return { creator, listings };
}

/** Edge-cached wrapper. Cache key is the handle; tag is `storefront-<handle>`
 *  so plate mutations can flush a specific creator's page instantly via
 *  revalidateTag(). */
function loadStorefront(handle: string) {
  return unstable_cache(
    () => loadStorefrontUncached(handle),
    ["storefront", handle],
    {
      revalidate: STOREFRONT_CACHE_TTL_SECONDS,
      tags: [`storefront-${handle}`],
    }
  )();
}

/**
 * Per-creator metadata so social shares of `/@handle` URLs render
 * with the creator's name + bio, not the generic root site copy.
 *
 * The OG image itself comes from the dynamic route handler at
 * `src/app/[handle]/opengraph-image.tsx` — Next.js auto-wires it to
 * this metadata via the `opengraph-image` file convention. Twitter
 * card mirrors via `twitter-image.tsx`.
 *
 * Re-uses the same edge-cached `loadStorefront` so we don't pay an
 * extra Supabase round-trip for the metadata lookup — the same data
 * powers the page render too.
 */
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<import("next").Metadata> {
  const { handle } = await params;
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();
  const { creator } = await loadStorefront(cleanHandle);

  if (!creator) {
    return {
      title: "Creator not found — KDER",
      description: "This KDER storefront doesn't exist.",
    };
  }

  const title = `${creator.display_name} on KDER`;
  const description =
    creator.bio?.trim() ||
    `Order plates from ${creator.display_name} in Houston. ${creator.total_plates} plate${
      creator.total_plates === 1 ? "" : "s"
    } available now on KDER.`;
  const url = `https://kder.club/@${cleanHandle}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "KDER",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { handle } = await params;
  // Strip @ prefix and decode URI component (handles %40 encoding)
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();

  // Cached storefront data + auth lookup run in parallel. The auth call
  // marks the route dynamic (so per-visitor data is correct) while the
  // storefront data is served from the edge cache for repeat visits.
  const supabase = await createClient();
  const [storefront, authResult] = await Promise.all([
    loadStorefront(cleanHandle),
    supabase.auth.getUser(),
  ]);
  const { creator, listings } = storefront;
  const currentUserId = authResult.data.user?.id ?? null;

  // Per-visitor: if they're signed in (incl. anon-auth) and have an
  // in-flight order with THIS creator, surface a banner linking back
  // to /order-confirmation. Skipped entirely for non-signed visitors.
  const activeOrder = await loadActiveOrder({
    supabase,
    creatorId: creator?.creator_id ?? null,
    userId: currentUserId,
    handle: cleanHandle,
  });

  return (
    <StorefrontClient
      handle={cleanHandle}
      initialCreator={creator}
      initialListings={listings}
      initialUserId={currentUserId}
      initialActiveOrder={activeOrder}
    />
  );
}

/**
 * Most-recent in-flight order between this visitor and this creator.
 * "In-flight" = pending | accepted | ready (not declined / completed /
 * cancelled). Returns null when there isn't one or the visitor isn't
 * signed in.
 *
 * Runs against the cookie-bound supabase client so RLS scopes the
 * read to the visitor's own orders only.
 */
async function loadActiveOrder({
  supabase,
  creatorId,
  userId,
  handle,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  creatorId: string | null;
  userId: string | null;
  handle: string;
}): Promise<ActiveOrderSummary | null> {
  if (!creatorId || !userId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await (supabase as any)
    .from("orders")
    .select("id, status")
    .eq("creator_id", creatorId)
    .eq("member_id", userId)
    .in("status", ["pending", "accepted", "ready"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; status: ActiveOrderSummary["status"] } | null;
  };

  if (!data) return null;
  return { id: data.id, status: data.status, creatorHandle: handle };
}
