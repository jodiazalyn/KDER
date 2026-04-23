"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateDetailSheetProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartQty: number;
  onAddToCart: (listing: Listing, qty: number) => void;
  /** Creator whose storefront this plate belongs to — shown as attribution
   *  so the customer can see WHO they're buying from right at the top of
   *  the order card. */
  creator: {
    display_name: string;
    handle: string;
    photo_url: string | null;
  };
}

/**
 * Order card. Opens when a PlateTile is tapped on the IG-style storefront.
 *
 * Layout is deliberately commerce-forward, not Instagram-like, once the user
 * is inside the sheet: short hero photo at the top, creator attribution so
 * they know who they're buying from, then name + price + description + tags
 * scrollable in the middle, and a sticky bottom bar with the quantity stepper
 * and Add-to-Cart button that's always reachable without scrolling.
 *
 * Quantity state is local and resets when the sheet closes so a user who
 * backs out and re-opens a different plate doesn't carry over the last qty.
 */
export function PlateDetailSheet({
  listing,
  open,
  onOpenChange,
  cartQty,
  onAddToCart,
  creator,
}: PlateDetailSheetProps) {
  const [qty, setQty] = useState(1);

  // Reset local qty each time the sheet opens (or the listing changes) so
  // users start from 1 on each new view. Deferred via setTimeout(0) to satisfy
  // React 19's react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setQty(1), 0);
    return () => clearTimeout(t);
  }, [open, listing?.id]);

  if (!listing) return null;

  const photo = listing.photos[0] || null;
  const soldOut = listing.quantity <= 0;
  const maxQty = Math.max(1, listing.quantity);

  const fulfillmentLabel =
    listing.fulfillment_type === "both"
      ? "Pickup & Delivery"
      : listing.fulfillment_type === "pickup"
        ? "Pickup"
        : "Delivery";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92vh] flex-col rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] p-0 text-white"
      >
        {/* Hero image — shorter than before so price + CTA stay close to the fold */}
        <div className="relative h-56 w-full flex-shrink-0 overflow-hidden bg-white/[0.04]">
          {photo ? (
            <Image
              src={photo}
              alt={listing.name}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff size={48} className="text-white/20" />
            </div>
          )}
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-md">
                Sold out
              </span>
            </div>
          )}
        </div>

        {/* Scrollable middle — creator attribution, title, price, description, tags */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {/* Creator attribution — they know who they're buying from */}
          <div className="flex items-center gap-2.5 text-xs">
            {creator.photo_url ? (
              <Image
                src={creator.photo_url}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 flex-shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-green-900/40 text-xs font-bold text-green-300">
                {creator.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-white/60">Sold by</span>
              <span className="font-semibold text-white">
                {creator.display_name}
              </span>
              <span className="text-green-300/70">@{creator.handle}</span>
            </div>
          </div>

          {/* Title + price row */}
          <SheetHeader className="mt-4 space-y-0 text-left">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="flex-1 text-2xl font-black leading-tight text-white">
                {listing.name}
              </SheetTitle>
              <span
                className="flex-shrink-0 text-3xl font-black text-green-300"
                style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
              >
                ${listing.price.toFixed(2)}
              </span>
            </div>
          </SheetHeader>

          {listing.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">
              {listing.description}
            </p>
          )}

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
              {fulfillmentLabel}
            </span>
            {listing.category_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-green-900/50 px-2.5 py-1 text-[11px] font-medium text-green-300"
              >
                {tag}
              </span>
            ))}
            {listing.allergens.map((allergen) => (
              <span
                key={allergen}
                className="rounded-full border border-orange-400/20 bg-orange-900/40 px-2.5 py-1 text-[11px] font-medium text-orange-300"
              >
                {allergen}
              </span>
            ))}
          </div>
        </div>

        {/* Sticky bottom bar — qty stepper + Add to Cart always reachable without scrolling */}
        <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#0A0A0A]/98 px-5 py-4 backdrop-blur-[24px]">
          {soldOut ? (
            <div className="flex h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-white/40">
              Sold out
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Qty stepper */}
              <div className="flex flex-shrink-0 items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white/60 disabled:text-white/20 active:scale-90 transition-transform"
                >
                  <Minus size={16} />
                </button>
                <span className="w-7 text-center text-base font-semibold text-white">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(maxQty, qty + 1))}
                  disabled={qty >= maxQty}
                  aria-label="Increase quantity"
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white/60 disabled:text-white/20 active:scale-90 transition-transform"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onAddToCart(listing, qty);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-all active:scale-95",
                  cartQty > 0
                    ? "bg-green-800/60 border border-green-400/30"
                    : "bg-[#1B5E20] shadow-[0_0_16px_rgba(27,94,32,0.4)]"
                )}
              >
                <ShoppingCart size={16} />
                {cartQty > 0
                  ? `Add more · $${(listing.price * qty).toFixed(2)}`
                  : `Add to cart · $${(listing.price * qty).toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
