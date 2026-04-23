"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateDetailSheetProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartQty: number;
  onAddToCart: (listing: Listing, qty: number) => void;
  /** One-click checkout — adds the plate to the cart and jumps straight to
   *  the checkout form, skipping the view-cart step entirely. Revenue
   *  capture on first interaction. */
  onBuyNow: (listing: Listing, qty: number) => void;
  creator: {
    display_name: string;
    handle: string;
    photo_url: string | null;
  };
}

/**
 * Plate detail sheet with scrollable details + a floating **Buy Now** button.
 *
 * Layout:
 *   - Scrollable card (full PlateCard-style details: hero image, title,
 *     description, price, tags, quantity stepper + Add to Cart, creator
 *     credit). Flows naturally top-to-bottom; user can scroll through the
 *     full content.
 *   - Floating **Buy Now** button pinned to the bottom of the sheet, always
 *     visible. One tap → add to cart + checkout form (skips view-cart).
 *
 * Add to Cart stays inline in the card body as a secondary action for
 * customers who want to build a multi-plate order before checking out.
 */
export function PlateDetailSheet({
  listing,
  open,
  onOpenChange,
  cartQty,
  onAddToCart,
  onBuyNow,
  creator,
}: PlateDetailSheetProps) {
  const [qty, setQty] = useState(1);

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

  const totalForQty = (listing.price * qty).toFixed(2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[90vh] max-h-[90vh] flex-col rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] p-0 text-white"
      >
        {/* Scrollable background — the full plate details */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <article
            className={cn(
              "overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] transition-opacity",
              soldOut && "opacity-60"
            )}
          >
            {/* Hero photo — aspect 16:10 like the original PlateCard */}
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

            {/* Card body */}
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

              {/* Inline qty + Add to Cart (secondary action for multi-plate orders) */}
              {!soldOut && (
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
                    }}
                    className={cn(
                      "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-bold text-white transition-all active:scale-95",
                      cartQty > 0
                        ? "border-green-400/30 bg-green-800/40"
                        : "border-white/20 bg-white/[0.06] hover:bg-white/[0.10]"
                    )}
                  >
                    <ShoppingCart size={15} />
                    {cartQty > 0 ? `In Cart (${cartQty})` : "Add to cart"}
                  </button>
                </div>
              )}

              {/* Creator credit */}
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
        </div>

        {/* Floating Buy Now — pinned to the sheet bottom, always visible.
            Primary revenue-capture CTA: one tap adds to cart + opens the
            checkout form, skipping the view-cart step. */}
        {!soldOut && (
          <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#0A0A0A]/95 px-4 pb-5 pt-3 backdrop-blur-[24px]">
            <button
              type="button"
              onClick={() => onBuyNow(listing, qty)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1B5E20] text-base font-bold text-white shadow-[0_8px_28px_rgba(27,94,32,0.55),0_0_24px_rgba(27,94,32,0.4)] transition-all active:scale-[0.98]"
            >
              <Zap size={18} className="fill-white" />
              Buy Now · ${totalForQty}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
