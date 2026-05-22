import Image from "next/image";
import { Star } from "lucide-react";
import { ListingChip } from "./ListingChip";
import { SHOWCASE_LISTINGS } from "./data/showcase-listings";

/**
 * The Stooty listing-card moment, KDER-fied. A 3-card showcase of
 * what a creator's storefront actually looks like — concrete proof
 * of the product behind every CTA on the page.
 *
 * Cards in pure white on cream with a soft shadow. Each card has a
 * square hero photo (or a placeholder block), creator + handle, a
 * rating row, and the pipe-row chip — exactly Stooty's pattern but
 * shaped for plates instead of studios.
 *
 * Photo paths point to `/public/images/landing/showcase/*.jpg`
 * which need to be added before merge. Without them the cards
 * render with the colored placeholder block and still look
 * intentional — they just lose the food photography.
 */

export function ListingShowcase() {
  return (
    <section
      aria-labelledby="listing-showcase-heading"
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
            02 / The Storefront
          </span>
          <h2
            id="listing-showcase-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            One link. Every plate.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            This is what your customers see when they tap your handle. A
            clean, branded storefront that lives at{" "}
            <span className="font-mono text-kder-ink">kder.club/@yourhandle</span>.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_LISTINGS.map((listing) => (
            <li
              key={listing.handle}
              className="overflow-hidden rounded-3xl border border-kder-line bg-kder-paper shadow-[0_8px_30px_rgba(15,15,15,0.04)] transition-shadow hover:shadow-[0_12px_40px_rgba(15,15,15,0.08)]"
            >
              {/* Hero photo. The colored fallback block reads as
                  "intentional placeholder" rather than "broken
                  image" — the chip row below already communicates
                  what the card is about. */}
              <div className="relative aspect-square w-full bg-kder-mint">
                {listing.imageSrc && (
                  <Image
                    src={listing.imageSrc}
                    alt={`Plate from ${listing.creator}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate text-base font-bold text-kder-ink">
                    {listing.creator}
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-kder-ink">
                    <Star
                      size={12}
                      className="fill-kder-green text-kder-green"
                    />
                    {listing.rating.toFixed(1)}
                  </span>
                </div>
                <p className="font-mono text-xs text-kder-ink-muted">
                  @{listing.handle}
                </p>
                <ListingChip listing={listing} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
