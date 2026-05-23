"use client";

import Image from "next/image";
import { ImageOff, Play } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateTileProps {
  listing: Listing;
  onClick: (listing: Listing) => void;
  /** Above-the-fold tiles preload their image for LCP. */
  priority?: boolean;
}

/**
 * Instagram-style square grid thumbnail.
 *
 * Pure image, no overlaid text by default. On desktop hover, a subtle overlay
 * reveals the plate name + price. Tap/click fires `onClick(listing)` so the
 * parent can open a detail sheet with full info + Add-to-Cart.
 *
 * Sold-out plates are dimmed and marked with a small "Sold out" pill in the
 * top-right corner so they're still scannable but clearly inactive.
 */
export function PlateTile({ listing, onClick, priority = false }: PlateTileProps) {
  const photo = listing.photos[0] || null;
  const soldOut = listing.quantity <= 0;

  return (
    <button
      type="button"
      onClick={() => onClick(listing)}
      className={cn(
        "group relative aspect-square w-full overflow-hidden bg-white/[0.04] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400",
        soldOut && "opacity-60"
      )}
      aria-label={`View ${listing.name}`}
    >
      {photo ? (
        <Image
          src={photo}
          alt={listing.name}
          fill
          sizes="(max-width: 640px) 33vw, 213px"
          priority={priority}
          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.04]">
          <ImageOff size={24} className="text-white/20" />
        </div>
      )}

      {/* Desktop hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hidden md:flex">
        <p className="max-w-[90%] truncate text-center text-sm font-semibold text-white">
          {listing.name}
        </p>
        <p className="text-sm font-bold text-green-300">
          ${listing.price.toFixed(2)}
        </p>
      </div>

      {/* Video affordance — matches the upload tile design.
          Centered Play icon makes the tile read as a video at a glance,
          even before hover. Pointer-events-none so taps fall through to
          the parent button. */}
      {listing.video && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 shadow-lg backdrop-blur-sm">
            <Play
              size={22}
              className="text-white translate-x-[1px]"
              fill="currentColor"
              strokeWidth={0}
            />
          </div>
        </div>
      )}

      {/* Sold-out pill — translucent glass over the photo */}
      {soldOut && (
        <span className="absolute right-1.5 top-1.5 rounded-full border border-white/[0.10] bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-[16px] backdrop-saturate-[180%]">
          Sold out
        </span>
      )}
    </button>
  );
}
