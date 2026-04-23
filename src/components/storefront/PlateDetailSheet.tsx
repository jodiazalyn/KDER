"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateDetailSheetProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartQty: number;
  onAddToCart: (listing: Listing, qty: number) => void;
  /** Creator whose storefront this plate belongs to — shown as a small credit
   *  at the bottom of the card. */
  creator: {
    display_name: string;
    handle: string;
    photo_url: string | null;
  };
}

/**
 * Plate detail sheet — structured to feel like the pre-IG-redesign PlateCard:
 * one self-contained card flowing top-to-bottom (image → name → description →
 * price → tags → inline qty stepper + Add-to-Cart). Opens as a bottom sheet
 * when a PlateTile is tapped so it integrates with the Instagram-style grid
 * on the storefront without sacrificing the older card's purchase UX.
 *
 * A small creator credit ("From @handle") sits below the Add-to-Cart so the
 * customer can still see who they're buying from without the header row
 * crowding the plate info itself.
 *
 * Quantity state resets when the sheet closes so re-opening a different
 * plate always starts at 1.
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

  // Reset qty on open; deferred for React 19's set-state-in-effect rule.
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
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] p-0 text-white"
      >
        <article
          className={cn(
            "mx-4 my-4 overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] transition-opacity",
            soldOut && "opacity-60"
          )}
        >
          {/* Hero photo — same aspect ratio as the original card */}
          <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.04]">
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

          {/* Content — matches the old PlateCard's vertical flow */}
          <div className="p-4">
            <SheetTitle className="text-xl font-bold leading-tight text-white">
              {listing.name}
            </SheetTitle>

            {listing.description && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70">
                {listing.description}
              </p>
            )}

            <p
              className="mt-3 text-2xl font-bold text-green-300"
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
            >
              ${listing.price.toFixed(2)}
            </p>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
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

            {/* Action row — inline qty stepper + Add to Cart */}
            {soldOut ? (
              <div className="mt-4 flex h-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-white/40">
                Sold out
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 disabled:text-white/20 active:scale-90 transition-transform"
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
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 disabled:text-white/20 active:scale-90 transition-transform"
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
                    "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
                    cartQty > 0
                      ? "bg-green-800/60 border border-green-400/30"
                      : "bg-[#1B5E20] shadow-[0_0_16px_rgba(27,94,32,0.4)]"
                  )}
                >
                  <ShoppingCart size={15} />
                  {cartQty > 0 ? `In Cart (${cartQty}) · Add more` : "Add to cart"}
                </button>
              </div>
            )}

            {/* Small creator credit — so the customer knows who they're buying
                from without pushing plate info down. */}
            <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-white/50">
              {creator.photo_url ? (
                <Image
                  src={creator.photo_url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 flex-shrink-0 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-green-900/40 text-[10px] font-bold text-green-300">
                  {creator.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span>
                From{" "}
                <span className="font-semibold text-white/80">
                  {creator.display_name}
                </span>{" "}
                <span className="text-green-300/70">@{creator.handle}</span>
              </span>
            </div>
          </div>
        </article>
      </SheetContent>
    </Sheet>
  );
}
