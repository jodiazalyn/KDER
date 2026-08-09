/**
 * Curated marketing-only sample listings for the landing page's
 * `<ListingShowcase />` section. Hardcoded (not Supabase-backed) for
 * three reasons:
 *
 *   1. The marketing page renders as a server component with no
 *      Supabase round-trip — keeps `/` fast and CDN-cacheable.
 *   2. Pre-launch we don't yet have a vetted set of public-good plates
 *      that would all photograph well together.
 *   3. We want hand-picked handles, photos, and prices that look
 *      polished — real Supabase data is messy by design.
 *
 * Once we have ≥10 vetted real listings we should swap to a Supabase
 * server fetch with `revalidate: 3600` and delete this file.
 *
 * Photos are hotlinked from Unsplash (allowed via images.unsplash.com
 * in next.config.ts remotePatterns). When real creators are onboarded
 * we'll replace these with their first plate photos.
 */

export interface ShowcaseListing {
  /** Display name shown above the chip row. */
  creator: string;
  /** Handle without the `@` — used to format the storefront URL. */
  handle: string;
  /** 1.0–5.0 rating shown in the chip row. */
  rating: number;
  /** Neighborhood — chip row + visual proof of locality. */
  neighborhood: string;
  /** Single category tag — appears between neighborhood and price. */
  category: string;
  /** Lowest active-listing price in dollars (no cents). */
  priceFrom: number;
  /** Path under `/public/` to a square hero photo for the card. */
  imageSrc?: string;
  /** Optional creator avatar; falls back to initials. */
  avatarSrc?: string;
}

// ?w=800 + auto=format keeps the network payload small while still
// looking sharp on retina displays. Next/Image will further optimize.
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=85&auto=format&fit=crop`;

export const SHOWCASE_LISTINGS: ShowcaseListing[] = [
  {
    creator: "Aunt Lulu's Kitchen",
    handle: "auntlulu",
    rating: 4.9,
    neighborhood: "Third Ward",
    category: "Soul Food",
    priceFrom: 14,
    // Golden fried chicken — clearly soul food, beauty-shot lighting.
    imageSrc: UNSPLASH("1626082896492-766af4eb6501"),
  },
  {
    creator: "Maya's Tamales",
    handle: "mayastamales",
    rating: 4.8,
    neighborhood: "Sharpstown",
    category: "Mexican",
    priceFrom: 12,
    // Vibrant action shot — lime being squeezed over tacos. Reads
    // unmistakably as fresh Mexican street food.
    imageSrc: UNSPLASH("1565299585323-38d6b0865b47"),
  },
  {
    creator: "DJ's Jerk Pit",
    handle: "djsjerk",
    rating: 5.0,
    neighborhood: "Alief",
    category: "Caribbean",
    priceFrom: 16,
    // Smoky grilled skewers over an open flame — peak jerk-pit vibe.
    imageSrc: UNSPLASH("1599487488170-d11ec9c172f0"),
  },
];
