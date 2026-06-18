"use client";

import Image from "next/image";
import { Clock, Users, ImageOff, Check } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Wide, full-width catering listing card.
 *
 * Unlike the square `PlateTile` (Instagram-style 3-col grid), catering
 * needs room to communicate pricing model + inclusions + lead time +
 * fulfillment options. The customer needs this info to decide if it's
 * worth submitting an inquiry — they're committing to a conversation,
 * not a one-tap purchase.
 *
 * Tapping toggles selection — the parent maintains a Set of selected
 * listing IDs and surfaces a "Request Catering" CTA once ≥1 is picked.
 */

interface Props {
  listing: Listing;
  selected: boolean;
  onToggle: (listingId: string) => void;
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  onsite: "On-site",
};

export function CateringMenuCard({ listing, selected, onToggle }: Props) {
  const photo = listing.photos[0] || null;
  const isPerHead = listing.catering_pricing_mode === "per_head";

  // Lead time as a friendly chip: 24h / 2 days / 1 week.
  const leadHours = listing.catering_lead_time_hours ?? 0;
  const leadLabel =
    leadHours >= 168
      ? `${Math.round(leadHours / 168)}wk ahead`
      : leadHours >= 24
        ? `${Math.round(leadHours / 24)}d ahead`
        : `${leadHours}h ahead`;

  const minGuests = listing.catering_min_guests ?? 0;
  const maxGuests = listing.catering_max_guests;
  const guestsLabel = maxGuests
    ? `${minGuests}–${maxGuests}`
    : `${minGuests}+`;

  return (
    <button
      type="button"
      onClick={() => onToggle(listing.id)}
      aria-pressed={selected}
      aria-label={`${selected ? "Unselect" : "Select"} ${listing.name} for catering inquiry`}
      className={cn(
        "group relative flex w-full gap-3 overflow-hidden rounded-2xl border bg-card p-3 text-left transition-all active:scale-[0.99]",
        selected
          ? "border-primary/50 bg-primary/10 shadow-[0_0_16px_rgba(127,201,60,0.25)]"
          : "border-border hover:border-primary/30"
      )}
    >
      {/* Photo (square thumb on the left) */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {photo ? (
          <Image
            src={photo}
            alt={listing.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff size={20} className="text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Right column — content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Top row: name + price */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
            {listing.name}
          </h3>
          <span className="shrink-0 text-right">
            <span className="text-base font-bold text-primary">
              ${listing.price.toFixed(0)}
            </span>
            <span className="ml-0.5 text-[10px] text-muted-foreground">
              {isPerHead ? "/guest" : "flat"}
            </span>
          </span>
        </div>

        {/* Inclusions summary — prefer the structured groups, fall back
            to the legacy free-text field, then to the description. Up
            to 3 groups, one line each ("Protein: A, B"). */}
        <InclusionsSummary listing={listing} />


        {/* Bottom row: metadata chips */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Users size={10} />
            {guestsLabel} guests
          </span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Clock size={10} />
            {leadLabel}
          </span>
          {listing.catering_fulfillment.map((f) => (
            <span
              key={f}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {FULFILLMENT_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      </div>

      {/* Selected checkmark badge in the corner */}
      {selected && (
        <span
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
          aria-hidden="true"
        >
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Compact 3-line summary of what's included. Reads structured groups
 *  first; falls back to the legacy text and finally the description. */
function InclusionsSummary({ listing }: { listing: Listing }) {
  const groups = listing.catering_inclusion_groups || {};
  const entries = Object.entries(groups).filter(
    ([, items]) => Array.isArray(items) && items.length > 0
  );
  if (entries.length > 0) {
    return (
      <div className="space-y-0.5">
        {entries.slice(0, 3).map(([group, items]) => (
          <p
            key={group}
            className="line-clamp-1 text-xs leading-snug text-muted-foreground"
          >
            <span className="font-semibold text-foreground/80">{group}:</span>{" "}
            {items?.join(", ")}
          </p>
        ))}
      </div>
    );
  }
  if (listing.catering_inclusions) {
    return (
      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {listing.catering_inclusions}
      </p>
    );
  }
  if (listing.description) {
    return (
      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {listing.description}
      </p>
    );
  }
  return null;
}
