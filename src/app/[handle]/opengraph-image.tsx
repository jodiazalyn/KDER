import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Per-creator dynamic Open Graph image.
 *
 * Renders a 1200x630 PNG share card the moment a Facebook / iMessage /
 * WhatsApp / Slack / Twitter scraper hits `/@handle`. Replaces the
 * generic KDER cloche with a creator-branded card so links actually
 * convert when shared.
 *
 * Layout (1200x630):
 *  ┌────────────────────────┬───────────────────────────────────┐
 *  │  KDER                  │                                   │
 *  │                        │                                   │
 *  │  [Display Name]        │   [photo grid — 1 to 4 plates]    │
 *  │  @handle               │                                   │
 *  │                        │                                   │
 *  │  [bio …]               │                                   │
 *  │                        │                                   │
 *  │  N plates · M orders   │                                   │
 *  └────────────────────────┴───────────────────────────────────┘
 *
 * Cached automatically by Next at the edge — `revalidate` mirrors the
 * storefront page TTL so a creator's new plate photo shows up in
 * shares within ~60s of upload.
 *
 * Why public Supabase client (not the cookie-bound one): OG image
 * generation runs on every scraper hit and must not depend on the
 * caller's session. Reads are public-row-only so anon RLS is enough.
 */

export const runtime = "edge";
export const revalidate = 60;
export const alt = "Creator storefront on KDER";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgPageProps {
  params: Promise<{ handle: string }>;
}

interface CreatorRow {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  handle: string;
  member_id: string;
}

interface ListingRow {
  photos: string[] | null;
}

async function loadOgData(handle: string): Promise<{
  displayName: string;
  bio: string | null;
  handle: string;
  photoUrl: string | null;
  plateCount: number;
  orderCount: number;
  platePhotos: string[];
} | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = (await (supabase as any)
    .from("members")
    .select("id, display_name, bio, photo_url, handle")
    .eq("handle", handle)
    .single()) as {
    data: (CreatorRow & { id: string }) | null;
  };

  if (!member) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creatorRow } = (await (supabase as any)
    .from("creators")
    .select("id")
    .eq("member_id", member.id)
    .single()) as { data: { id: string } | null };

  if (!creatorRow) return null;

  // Listings + completed-order count in parallel — same pattern as the
  // page-level loader. Photos are flattened across the first ~4 active
  // listings so the right-hand grid has visual material.
  const [listingsRes, ordersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("listings")
      .select("photos")
      .eq("creator_id", creatorRow.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8) as Promise<{ data: ListingRow[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", creatorRow.id)
      .eq("status", "completed") as Promise<{ count: number | null }>,
  ]);

  const listings = listingsRes.data ?? [];
  const platePhotos: string[] = [];
  for (const listing of listings) {
    if (listing.photos && listing.photos.length > 0) {
      platePhotos.push(listing.photos[0]);
      if (platePhotos.length >= 4) break;
    }
  }

  return {
    displayName: member.display_name || "Creator",
    bio: member.bio,
    handle: member.handle,
    photoUrl: member.photo_url,
    plateCount: listings.length,
    orderCount: ordersRes.count ?? 0,
    platePhotos,
  };
}

export default async function StorefrontOgImage({ params }: OgPageProps) {
  const { handle } = await params;
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();
  const data = await loadOgData(cleanHandle);

  // Fallback: creator not found → render a generic KDER card so the
  // share preview never goes blank. Not as compelling as the real card
  // but better than the unstyled fail state most scrapers will show.
  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0A0A0A",
            color: "white",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2 }}>
            KDER
          </div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.6)", marginTop: 16 }}>
            Feed the city. Own your income.
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const { displayName, bio, photoUrl, plateCount, orderCount, platePhotos } = data;
  const truncatedBio =
    bio && bio.length > 140 ? `${bio.slice(0, 137).trim()}…` : bio;

  // Right-hand visual: prefer plate photos (more interesting), fall
  // back to creator avatar, then to a brand-color block. Choosing a
  // grid layout based on photo count keeps small storefronts looking
  // intentional rather than half-empty.
  const heroPhotos = platePhotos.length > 0 ? platePhotos : photoUrl ? [photoUrl] : [];
  const photoLayout =
    heroPhotos.length === 0
      ? "empty"
      : heroPhotos.length === 1
        ? "single"
        : heroPhotos.length === 2
          ? "double"
          : "grid";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#0A0A0A",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Left panel: text content */}
        <div
          style={{
            width: heroPhotos.length === 0 ? "100%" : "55%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 64,
            justifyContent: "space-between",
          }}
        >
          {/* Brand mark top-left */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: -1,
              color: "white",
            }}
          >
            KDER
          </div>

          {/* Creator name + bio middle block */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                letterSpacing: -2,
                lineHeight: 1.05,
                color: "white",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 32,
                color: "rgba(255,255,255,0.5)",
                marginTop: 8,
              }}
            >
              @{cleanHandle}
            </div>
            {truncatedBio && (
              <div
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 32,
                  lineHeight: 1.35,
                  // Satori needs explicit display:flex on text containers
                  // when they wrap; without it some glyphs clip.
                  display: "flex",
                }}
              >
                {truncatedBio}
              </div>
            )}
          </div>

          {/* Stats row bottom */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 32,
              fontSize: 28,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "white", marginRight: 8 }}>
                {plateCount}
              </span>
              <span>{plateCount === 1 ? "plate" : "plates"}</span>
            </div>
            {orderCount > 0 && (
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "white", marginRight: 8 }}>
                  {orderCount}
                </span>
                <span>{orderCount === 1 ? "order" : "orders"}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "auto",
                color: "rgba(255,255,255,0.4)",
                fontSize: 22,
              }}
            >
              kder.club
            </div>
          </div>
        </div>

        {/* Right panel: photo grid (only renders when we have at least one) */}
        {photoLayout !== "empty" && (
          <div
            style={{
              width: "45%",
              height: "100%",
              display: "flex",
              flexDirection: photoLayout === "double" ? "column" : "row",
              flexWrap: photoLayout === "grid" ? "wrap" : "nowrap",
            }}
          >
            {photoLayout === "single" && (
              <img
                src={heroPhotos[0]}
                alt=""
                width={540}
                height={630}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
            {photoLayout === "double" &&
              heroPhotos.slice(0, 2).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={540}
                  height={315}
                  style={{
                    width: "100%",
                    height: "50%",
                    objectFit: "cover",
                  }}
                />
              ))}
            {photoLayout === "grid" &&
              heroPhotos.slice(0, 4).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={270}
                  height={315}
                  style={{
                    width: "50%",
                    height: "50%",
                    objectFit: "cover",
                  }}
                />
              ))}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
