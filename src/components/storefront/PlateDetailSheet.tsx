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
  // Required-choice selections (migration 023). Keyed by group id →
  // the chosen option name. Single-select, so exactly one name per
  // group. Reset alongside extras on open.
  const [groupChoices, setGroupChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setQty(1);
      setExtraQtys({});
      setGroupChoices({});
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

  // Required choice groups (migration 023). The customer must pick
  // exactly one option in each before they can order.
  const optionGroups = listing.option_groups ?? [];
  const requiredGroups = optionGroups.filter((g) => g.required);
  const allRequiredSatisfied = requiredGroups.every((g) =>
    Boolean(groupChoices[g.id])
  );

  // Snapshot the required picks as cart extras, tagged with their
  // group title so the creator sees "Protein: 2 Beef Patties" on the
  // order. qty 1 — a required choice is one-per-plate, matching the
  // flat (non-qty-multiplied) way extras already work. Snapshots the
  // option's current price so a later listing edit can't shift this
  // customer's cart.
  const requiredExtras = requiredGroups.flatMap((g) => {
    const chosenName = groupChoices[g.id];
    if (!chosenName) return [];
    const opt = g.options.find((o) => o.name === chosenName);
    if (!opt) return [];
    return [
      {
        name: opt.name,
        price_cents: opt.price_cents,
        qty: 1,
        group: g.title,
      },
    ];
  });

  // Build the optional add-on payload for the cart based on the
  // current picks. Filter out zero-qty entries — they're not on
  // the order. Each entry snapshots the listing's current
  // name/price_cents so a creator editing the listing later
  // doesn't shift this customer's cart.
  const optionalExtras = (listing.extras ?? [])
    .map((ex) => ({
      name: ex.name,
      price_cents: ex.price_cents,
      qty: extraQtys[ex.name] ?? 0,
    }))
    .filter((ex) => ex.qty > 0);

  // Combined payload handed to the cart: required picks first, then
  // optional add-ons.
  const selectedExtras = [...requiredExtras, ...optionalExtras];

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
        className="flex max-h-[90vh] flex-col rounded-t-3xl border-border p-0 text-foreground"
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
                <div className="flex aspect-[16/10] items-center justify-center bg-muted">
                  <ImageOff size={48} className="text-muted-foreground/40" />
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
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    Pre-order · available {preOrderDateLong}
                  </span>
                </div>
              )}

              <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                {listing.name}
              </SheetTitle>

              {listing.description && (
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                  {listing.description}
                </p>
              )}

              <p className="mt-3 text-2xl font-bold text-primary">
                ${listing.price.toFixed(2)}
              </p>

              {/* Required choices (migration 023) — radio groups the
                  customer must pick exactly one from. Rendered above
                  the optional extras so the required decision comes
                  first. Each group shows "Required · Select 1"; a
                  missing pick blocks Add to Cart / Buy Now below. */}
              {!soldOut &&
                requiredGroups.map((g) => {
                  const chosen = groupChoices[g.id];
                  return (
                    <fieldset
                      key={g.id}
                      className="mt-4 rounded-2xl border border-border bg-muted/40 p-3"
                    >
                      <legend className="flex items-center gap-1.5 px-1 text-sm font-bold text-foreground">
                        {g.title}
                      </legend>
                      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                        <span className="text-primary">Required</span>
                        <span className="text-muted-foreground/60">
                          · Select 1
                        </span>
                      </p>
                      <ul className="space-y-1">
                        {g.options.map((opt) => {
                          const isChosen = chosen === opt.name;
                          const isFree = opt.price_cents === 0;
                          return (
                            <li key={opt.name}>
                              <button
                                type="button"
                                onClick={() =>
                                  setGroupChoices((prev) => ({
                                    ...prev,
                                    [g.id]: opt.name,
                                  }))
                                }
                                aria-pressed={isChosen}
                                className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:scale-[0.99] transition-transform"
                              >
                                {/* Radio dot */}
                                <span
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                    isChosen
                                      ? "border-primary"
                                      : "border-muted-foreground/40"
                                  )}
                                >
                                  {isChosen && (
                                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                  {opt.name}
                                </span>
                                {!isFree && (
                                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                                    +$
                                    {(opt.price_cents / 100).toFixed(
                                      opt.price_cents % 100 === 0 ? 0 : 2
                                    )}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </fieldset>
                  );
                })}

              {/* Extras picker — only when the creator defined any.
                  Sits between price and tags so the customer sees
                  optional add-ons in the same visual cluster as the
                  price decision. Each extra has a -/+ stepper; $0
                  extras read "Free" so customers know they have to
                  opt in by tapping +. (An earlier "Included" copy
                  led a creator's customers to think things like
                  "extra spice" came on the plate by default.) */}
              {!soldOut && (listing.extras ?? []).length > 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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
                            <p className="truncate text-sm text-foreground">
                              {ex.name}
                            </p>
                            <p
                              className={
                                isFree
                                  ? "text-[11px] font-semibold uppercase tracking-wider text-primary"
                                  : "text-[11px] text-muted-foreground"
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
                              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground disabled:opacity-40 active:scale-90 transition-transform"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-foreground">
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
                              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground disabled:opacity-40 active:scale-90 transition-transform"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {extrasSubtotalCents > 0 && (
                    <p className="mt-2 text-right text-[11px] text-muted-foreground">
                      Extras subtotal:{" "}
                      <span className="font-semibold text-foreground">
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
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {fulfillmentLabel}
                </span>
                {listing.category_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
                {listing.allergens.map((allergen) => (
                  <span
                    key={allergen}
                    className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-300"
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
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:opacity-40 active:scale-90 transition-transform"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-7 text-center text-base font-semibold text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(Math.min(maxQty, qty + 1))}
                      disabled={qty >= maxQty}
                      aria-label="Increase quantity"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:opacity-40 active:scale-90 transition-transform"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!allRequiredSatisfied}
                    onClick={() => {
                      if (!allRequiredSatisfied) return;
                      onAddToCart(
                        listing,
                        qty,
                        selectedExtras.length > 0 ? selectedExtras : undefined
                      );
                    }}
                    className={cn(
                      "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
                      cartQty > 0
                        ? "!border-primary/30 !bg-primary/15 text-primary"
                        : "border-border bg-muted text-foreground hover:bg-muted/70"
                    )}
                  >
                    <ShoppingCart size={15} />
                    {cartQty > 0 ? `In Cart (${cartQty})` : "Add to cart"}
                  </button>
                </div>
              )}

              {/* Creator credit */}
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                {creator.photo_url ? (
                  <Image
                    src={creator.photo_url}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 flex-shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border bg-primary/15 text-[10px] font-bold text-primary">
                    {creator.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>
                  From{" "}
                  <span className="font-semibold text-foreground">
                    {creator.display_name}
                  </span>{" "}
                  <span className="text-primary">@{creator.handle}</span>
                </span>
              </div>
            </div>
          </article>
        </div>

        {/* Floating Buy Now — pinned to the sheet bottom, always visible.
            Primary revenue-capture CTA: one tap adds to cart + opens the
            checkout form, skipping the view-cart step. */}
        {!soldOut && (
          <div className="flex-shrink-0 border-t border-border bg-background/80 px-4 pb-5 pt-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
            {/* Nudge when a required choice is still unpicked — the
                buttons are disabled, so tell the customer why. */}
            {!allRequiredSatisfied && (
              <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                Pick your{" "}
                <span className="font-semibold text-foreground">
                  {requiredGroups
                    .filter((g) => !groupChoices[g.id])
                    .map((g) => g.title)
                    .join(" & ")}
                </span>{" "}
                to continue
              </p>
            )}
            <button
              type="button"
              disabled={!allRequiredSatisfied}
              onClick={() => {
                if (!allRequiredSatisfied) return;
                onBuyNow(
                  listing,
                  qty,
                  selectedExtras.length > 0 ? selectedExtras : undefined
                );
              }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-base font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
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
