"use client";

import Image from "next/image";
import { ImageOff, Play, Truck, ShoppingBag } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateOfferCardProps {
  listing: Listing;
  onClick: (listing: Listing) => void;
  /** Above-the-fold cards preload their image for LCP. */
  priority?: boolean;
}

const FULFILLMENT_LABEL: Record<string, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  both: "Pickup or delivery",
};

/**
 * Airbnb-Experiences-style horizontal offer card for a plate.
 *
 * Thumbnail on the left, then title + short description + a price line
 * ("$12.99 / plate · Minimum 2 to order"). Reads as a bookable "offering"
 * rather than a photo tile — the storefront redesign lists these in a
 * single vertical column instead of the old 3-col Instagram grid.
 *
 * Tap/click fires `onClick(listing)` so the parent opens the detail sheet
 * with full info + Add-to-Cart / Buy Now (unchanged flow).
 */
export function PlateOfferCard({
  listing,
  onClick,
  priority = false,
}: PlateOfferCardProps) {
  const photo = listing.photos[0] || null;
  const soldOut = listing.quantity <= 0;
  const preOrderDate = listing.pre_order_available_date
    ? new Date(
        listing.pre_order_available_date + "T00:00:00"
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const fulfillmentLabel = FULFILLMENT_LABEL[listing.fulfillment_type] ?? null;

  return (
    <button
      type="button"
      onClick={() => onClick(listing)}
      aria-label={`View ${listing.name}`}
      className={cn(
        "group relative flex w-full gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 text-left transition-all hover:border-primary/30 active:scale-[0.99]",
        soldOut && "opacity-60"
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {photo ? (
          <Image
            src={photo}
            alt={listing.name}
            fill
            sizes="96px"
            priority={priority}
            className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff size={20} className="text-muted-foreground/40" />
          </div>
        )}

        {/* Video affordance */}
        {listing.video && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 shadow-lg backdrop-blur-sm">
              <Play
                size={16}
                className="translate-x-[1px] text-white"
                fill="currentColor"
                strokeWidth={0}
              />
            </div>
          </div>
        )}

        {/* Sold-out overlay pill */}
        {soldOut && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.10] bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Sold out
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[15px] font-semibold leading-tight text-foreground line-clamp-1">
            {listing.name}
          </h3>
          {preOrderDate && !soldOut && (
            <span className="shrink-0 rounded-full border border-green-400/30 bg-green-900/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-200">
              Pre-order · {preOrderDate}
            </span>
          )}
        </div>

        {listing.description && (
          <p className="text-xs leading-snug text-muted-foreground line-clamp-2">
            {listing.description}
          </p>
        )}

        {/* Price + minimum line — the Airbnb "$X · Minimum Y to book" pattern */}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1">
          <span className="text-sm font-bold text-foreground">
            ${listing.price.toFixed(2)}
            <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">
              / plate
            </span>
          </span>
          {listing.min_order && listing.min_order > 1 && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Minimum {listing.min_order} to order
              </span>
            </>
          )}
          {fulfillmentLabel && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
              {listing.fulfillment_type === "delivery" ? (
                <Truck size={11} />
              ) : (
                <ShoppingBag size={11} />
              )}
              {fulfillmentLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
