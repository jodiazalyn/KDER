"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Calendar, ImageOff, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { MediaCarousel } from "./MediaCarousel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { CartItemExtra, Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateDetailSheetProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartQty: number;
  onAddToCart: (
    listing: Listing,
    qty: number,
    selectedExtras?: CartItemExtra[]
  ) => void;
  /** One-click checkout — adds the plate to the cart and jumps straight to
   *  the checkout form, skipping the view-cart step entirely. Revenue
   *  capture on first interaction. */
  onBuyNow: (
    listing: Listing,
    qty: number,
    selectedExtras?: CartItemExtra[]
  ) => void;
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
  // Per-extra picks for THIS detail-sheet session. Reset each time
  // the sheet opens or the listing changes so the customer starts
  // fresh. Stored as a Map keyed by extra.name (extras are looked
  // up by name throughout the cart pipeline).
  const [extraQtys, setExtraQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setQty(1);
      setExtraQtys({});
    }, 0);
    return () => clearTimeout(t);
  }, [open, listing?.id]);

  if (!listing) return null;

  const soldOut = listing.quantity <= 0;
  const hasMedia = listing.photos.length > 0 || !!listing.video;
  const maxQty = Math.max(1, listing.quantity);

  // Pre-order context. NULL = instant. Long label "Thu, Mar 14"
  // is shown in the under-photo banner so customers know the
  // weekday they're planning for.
  const preOrderDateLong = listing.pre_order_available_date
    ? new Date(
        listing.pre_order_available_date + "T00:00:00"
      ).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  const fulfillmentLabel =
    listing.fulfillment_type === "both"
      ? "Pickup & Delivery"
      : listing.fulfillment_type === "pickup"
        ? "Pickup"
        : "Delivery";

  // Build the selected-extras payload for the cart based on the
  // current picks. Filter out zero-qty entries — they're not on
  // the order. Each entry snapshots the listing's current
  // name/price_cents so a creator editing the listing later
  // doesn't shift this customer's cart.
  const selectedExtras = (listing.extras ?? [])
    .map((ex) => ({
      name: ex.name,
      price_cents: ex.price_cents,
      qty: extraQtys[ex.name] ?? 0,
    }))
    .filter((ex) => ex.qty > 0);

  const extrasSubtotalCents = selectedExtras.reduce(
    (sum, ex) => sum + ex.price_cents * ex.qty,
    0
  );
  const totalForQty = (
    listing.price * qty +
    extrasSubtotalCents / 100
  ).toFixed(2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[90vh] max-h-[90vh] flex-col rounded-t-3xl border-white/[0.22] p-0 text-white"
      >
        {/* Scrollable background — the full plate details */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <article
            className={cn(
              "glass-card-elevated overflow-hidden rounded-3xl transition-opacity",
              soldOut && "opacity-60"
            )}
          >
            {/* Hero — media carousel (video-first) or fallback placeholder */}
            <div className="relative overflow-hidden">
              {hasMedia ? (
                <MediaCarousel
                  photos={listing.photos}
                  video={listing.video}
                  title={listing.name}
                  priority
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center bg-white/[0.04]">
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
              {/* Pre-order pill on the hero (same treatment as the
                  storefront tile). Hidden when sold-out. */}
              {preOrderDateLong && !soldOut && (
                <span className="absolute right-2 top-2 rounded-full border border-green-400/30 bg-green-900/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-200 backdrop-blur-[16px] backdrop-saturate-[180%]">
                  Pre-order
                </span>
              )}
            </div>

            {/* Card body */}
            <div className="p-4">
              {/* Pre-order banner — directly under the photo/video,
                  above the name. Tells the customer what date the
                  food is actually ready before they read anything
                  else. Calendar icon makes the date scan as a
                  schedule signal. */}
              {preOrderDateLong && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-400/[0.25] bg-green-900/[0.20] px-3 py-2">
                  <Calendar size={14} className="text-green-300" />
                  <span className="text-xs font-semibold text-green-100">
                    Pre-order · available {preOrderDateLong}
                  </span>
                </div>
              )}

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

              {/* Extras picker — only when the creator defined any.
                  Sits between price and tags so the customer sees
                  optional add-ons in the same visual cluster as the
                  price decision. Each extra has a -/+ stepper; $0
                  extras read "Free" so customers know they have to
                  opt in by tapping +. (An earlier "Included" copy
                  led a creator's customers to think things like
                  "extra spice" came on the plate by default.) */}
              {!soldOut && (listing.extras ?? []).length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                    Add extras
                  </p>
                  <ul className="space-y-1.5">
                    {listing.extras.map((ex) => {
                      const exQty = extraQtys[ex.name] ?? 0;
                      const isFree = ex.price_cents === 0;
                      return (
                        <li
                          key={ex.name}
                          className="flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white/90">
                              {ex.name}
                            </p>
                            <p
                              className={
                                isFree
                                  ? "text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80"
                                  : "text-[11px] text-white/45"
                              }
                            >
                              {isFree
                                ? "Free"
                                : `$${(ex.price_cents / 100).toFixed(
                                    ex.price_cents % 100 === 0 ? 0 : 2
                                  )} each`}
                            </p>
                          </div>
                          <div className="glass-btn-pill flex items-center gap-1 !p-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExtraQtys((prev) => {
                                  const next = { ...prev };
                                  const cur = next[ex.name] ?? 0;
                                  if (cur <= 1) delete next[ex.name];
                                  else next[ex.name] = cur - 1;
                                  return next;
                                })
                              }
                              disabled={exQty <= 0}
                              aria-label={`Decrease ${ex.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 disabled:text-white/15 active:scale-90 transition-transform"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-white">
                              {exQty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExtraQtys((prev) => ({
                                  ...prev,
                                  [ex.name]: Math.min(
                                    99,
                                    (prev[ex.name] ?? 0) + 1
                                  ),
                                }))
                              }
                              disabled={exQty >= 99}
                              aria-label={`Increase ${ex.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 disabled:text-white/15 active:scale-90 transition-transform"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {extrasSubtotalCents > 0 && (
                    <p className="mt-2 text-right text-[11px] text-white/55">
                      Extras subtotal:{" "}
                      <span className="font-semibold text-white/80">
                        ${(extrasSubtotalCents / 100).toFixed(
                          extrasSubtotalCents % 100 === 0 ? 0 : 2
                        )}
                      </span>
                    </p>
                  )}
                </div>
              )}

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
                  <div className="glass-btn-pill flex items-center gap-1 !p-0">
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
                      onAddToCart(
                        listing,
                        qty,
                        selectedExtras.length > 0 ? selectedExtras : undefined
                      );
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
          <div className="flex-shrink-0 border-t border-white/[0.10] bg-[#0A0A0A]/80 px-4 pb-5 pt-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
            <button
              type="button"
              onClick={() =>
                onBuyNow(
                  listing,
                  qty,
                  selectedExtras.length > 0 ? selectedExtras : undefined
                )
              }
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
