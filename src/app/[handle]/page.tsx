import { StorefrontClient } from "./storefront-client";
import { createClient } from "@/lib/supabase/server";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import type { CreatorProfile } from "@/lib/creator-store";
import type { Listing } from "@/types";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
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

async function loadStorefront(handle: string): Promise<{
  creator: CreatorProfile | null;
  listings: Listing[];
}> {
  const supabase = await createClient();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listingsData } = (await (supabase as any)
    .from("listings")
    .select("*")
    .eq("creator_id", creatorRow.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })) as { data: Listing[] | null };

  // Count completed orders for the stats row on the IG-style profile header.
  // Scoped to status='completed' so cancelled/declined/in-progress orders don't
  // inflate the "Orders" figure shown to potential customers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: completedOrdersCount } = (await (supabase as any)
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", creatorRow.id)
    .eq("status", "completed")) as { count: number | null };

  const listings = listingsData ?? [];

  const creator: CreatorProfile = {
    display_name: member.display_name || "Creator",
    bio: member.bio,
    photo_url: member.photo_url,
    handle: member.handle,
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

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { handle } = await params;
  // Strip @ prefix and decode URI component (handles %40 encoding)
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();

  const { creator, listings } = await loadStorefront(cleanHandle);

  return (
    <StorefrontClient
      handle={cleanHandle}
      initialCreator={creator}
      initialListings={listings}
    />
  );
}
