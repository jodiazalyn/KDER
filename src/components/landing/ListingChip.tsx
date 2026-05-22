import type { ShowcaseListing } from "./data/showcase-listings";

/**
 * Single-row pipe-separated chip — Stooty's signature listing-info
 * treatment, KDER-fied for plates instead of studios.
 *
 *   Aunt Lulu's Kitchen | 4.9 | Third Ward | Soul Food | From $14
 *
 * Renders as a single uppercase row in `text-kder-ink-muted` so it
 * reads as data/metadata rather than headline copy. Used inside the
 * `<ListingShowcase />` cards and as the hero's preview teaser.
 */

interface ListingChipProps {
  listing: ShowcaseListing;
  /** "compact" tightens spacing for the hero preview row. */
  variant?: "card" | "compact";
}

export function ListingChip({ listing, variant = "card" }: ListingChipProps) {
  const segments = [
    listing.creator,
    listing.rating.toFixed(1),
    listing.neighborhood,
    listing.category,
    `From $${listing.priceFrom}`,
  ];

  return (
    <p
      className={[
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold uppercase tracking-[0.12em] text-kder-ink-muted",
        variant === "compact" ? "text-[11px]" : "text-xs",
      ].join(" ")}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-x-2">
          {seg}
          {i < segments.length - 1 && (
            <span aria-hidden="true" className="text-kder-line">
              |
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
