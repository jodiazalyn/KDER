"use client";

import Image from "next/image";
import { MoreVertical, ImageOff } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-white/10 text-white/60" },
  active: { label: "Active", className: "bg-green-900/50 text-green-300" },
  paused: { label: "Paused", className: "bg-yellow-900/40 text-yellow-300" },
  archived: { label: "Archived", className: "bg-white/10 text-white/40" },
};

interface PlateCardProps {
  listing: Listing;
  onMenuClick: (listing: Listing) => void;
}

export function PlateCard({ listing, onMenuClick }: PlateCardProps) {
  const badge = STATUS_BADGES[listing.status] || STATUS_BADGES.draft;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]">
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
          <div className="flex h-full items-center justify-center bg-white/[0.04]">
            <ImageOff size={32} className="text-white/20" />
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

        {/* Menu button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick(listing);
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 active:scale-90"
          aria-label={`Menu for ${listing.name}`}
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Info — bottom 40% */}
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-white">
          {listing.name}
        </h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-base font-bold text-green-300">
            ${listing.price.toFixed(2)}
          </span>
          {listing.order_count > 0 && (
            <span className="text-xs text-white/40">
              {listing.order_count} orders
            </span>
          )}
        </div>

        {/* Category tags + fulfillment */}
        <div className="mt-2 flex flex-wrap gap-1">
          {/* Fulfillment pill */}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
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
              className="rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
