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
 * Photo paths point to `/public/images/landing/showcase/*.jpg` —
 * those assets need to be added before merge. Until then the cards
 * fall back to a colored placeholder via the `imageSrc?` undefined
 * branch in `<ListingChip />`.
 */

export interface ShowcaseListing {
  /** Display name shown above the chip row. */
  creator: string;
  /** Handle without the `@` — used to format the storefront URL. */
  handle: string;
  /** 1.0–5.0 rating shown in the chip row. */
  rating: number;
  /** Houston neighborhood — chip row + visual proof of locality. */
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

export const SHOWCASE_LISTINGS: ShowcaseListing[] = [
  {
    creator: "Aunt Lulu's Kitchen",
    handle: "auntlulu",
    rating: 4.9,
    neighborhood: "Third Ward",
    category: "Soul Food",
    priceFrom: 14,
    imageSrc: "/images/landing/showcase/auntlulu.jpg",
  },
  {
    creator: "Maya's Tamales",
    handle: "mayastamales",
    rating: 4.8,
    neighborhood: "Sharpstown",
    category: "Mexican",
    priceFrom: 12,
    imageSrc: "/images/landing/showcase/mayas.jpg",
  },
  {
    creator: "DJ's Jerk Pit",
    handle: "djsjerk",
    rating: 5.0,
    neighborhood: "Alief",
    category: "Caribbean",
    priceFrom: 16,
    imageSrc: "/images/landing/showcase/djsjerk.jpg",
  },
];
