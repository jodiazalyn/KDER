"use client";

import Image from "next/image";
import { MoreVertical, ImageOff } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted/40 text-muted-foreground" },
  active: { label: "Active", className: "bg-primary/10 text-primary dark:bg-green-900/50 dark:text-green-300" },
  paused: { label: "Paused", className: "bg-amber-500/10 text-amber-700 dark:bg-orange-900/50 dark:text-orange-300" },
  archived: { label: "Archived", className: "bg-muted/40 text-muted-foreground/60" },
};

interface PlateCardProps {
  listing: Listing;
  onMenuClick: (listing: Listing) => void;
}

export function PlateCard({ listing, onMenuClick }: PlateCardProps) {
  const badge = STATUS_BADGES[listing.status] || STATUS_BADGES.draft;

  return (
    <div className="glass-card-elevated rounded-glass-xl overflow-hidden">
      {/* Photo — top 60% */}
      <div className="relative aspect-[4/3]">
        {listing.photos.length > 0 ? (
          <Image
            src={listing.photos[0]}
            alt={`Photo of ${listing.name}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/30">
            <ImageOff size={32} className="text-muted-foreground/60" />
          </div>
        )}

        {/* Status badge */}
        <div
          className={cn(
            "absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium",
            badge.className
          )}
        >
          {badge.label}
        </div>

        {/* Catering tag — sits just below the status badge in purple so
            the creator can tell at a glance which listings are catering
            vs regular plates. No badge for plates (the default kind),
            keeping the visual noise down for creators who only sell
            on-demand. */}
        {listing.kind === "catering" && (
          <div className="absolute left-2 top-9 rounded-full bg-purple-900/50 px-2.5 py-0.5 text-xs font-medium text-purple-200">
            Catering
          </div>
        )}

        {/* Menu button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick(listing);
          }}
          // 44px tap target per Apple HIG (was h-8 = 32px). Sits over
          // the photo so we use a darker scrim background instead of
          // glass-btn-pill for contrast.
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 active:scale-90"
          aria-label={`Menu for ${listing.name}`}
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Info — bottom 40% */}
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {listing.name}
        </h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-base font-bold text-primary">
            ${listing.price.toFixed(2)}
          </span>
          {listing.order_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {listing.order_count} orders
            </span>
          )}
        </div>

        {/* Category tags + fulfillment */}
        <div className="mt-2 flex flex-wrap gap-1">
          {/* Fulfillment pill */}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {listing.fulfillment_type === "pickup"
              ? "Pickup"
              : listing.fulfillment_type === "delivery"
                ? "Delivery"
                : "Pickup & Delivery"}
          </span>

          {/* Category pills */}
          {listing.category_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
