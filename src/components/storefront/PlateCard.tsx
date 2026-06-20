"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Plus, Minus, ShoppingCart, Calendar } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateCardProps {
  listing: Listing;
  cartQty: number;
  onAddToCart: (listing: Listing, qty: number) => void;
  /** First card on the page should preload its hero image (LCP candidate). */
  priority?: boolean;
}

export function PlateCard({
  listing,
  cartQty,
  onAddToCart,
  priority = false,
}: PlateCardProps) {
  const [qty, setQty] = useState(1);
  const photo = listing.photos[0] || "/icons/kder-logo.png";
  const soldOut = listing.quantity <= 0;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pre-order context. The pill on the photo gets a compact short
  // date ("MAR 14"), the description-area banner gets a friendlier
  // weekday-included label ("Thu, Mar 14") so customers know what
  // day of the week to plan around.
  const preOrderDateShort = listing.pre_order_available_date
    ? new Date(
        listing.pre_order_available_date + "T00:00:00"
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const preOrderDateLong = listing.pre_order_available_date
    ? new Date(
        listing.pre_order_available_date + "T00:00:00"
      ).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  // Autoplay video when card scrolls into view, pause when it leaves.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fulfillmentLabel =
    listing.fulfillment_type === "both"
      ? "Pickup & Delivery"
      : listing.fulfillment_type === "pickup"
        ? "Pickup"
        : "Delivery";

  return (
    <article
      className={cn(
        "glass-card-elevated overflow-hidden rounded-3xl transition-opacity",
        soldOut && "opacity-60"
      )}
    >
      {/* Hero — autoplaying video or static photo */}
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        {listing.video ? (
          <>
            <video
              ref={videoRef}
              src={listing.video}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
              <span className="text-[10px] font-bold text-white">▶ VIDEO</span>
            </div>
          </>
        ) : (
          <Image
            src={photo}
            alt={listing.name}
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            priority={priority}
            className="object-cover"
          />
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-md">
              Sold out
            </span>
          </div>
        )}
        {/* Pre-order pill — top-right corner of the hero. Hidden
            when sold-out so the two badges don't fight. */}
        {preOrderDateShort && !soldOut && (
          <span className="absolute right-2 top-2 rounded-full border border-green-400/30 bg-green-900/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-200 backdrop-blur-[16px] backdrop-saturate-[180%]">
            Pre-order · {preOrderDateShort}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Pre-order banner — sits just under the photo/video,
            above the name, so the customer sees the availability
            date as soon as they read past the hero. Uses a calendar
            icon and the longer "Thu, Mar 14" label for clarity. */}
        {preOrderDateLong && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-400/[0.25] bg-green-900/[0.20] px-3 py-2">
            <Calendar size={14} className="text-accent-foreground" />
            <span className="text-xs font-semibold text-accent-foreground">
              Pre-order · available {preOrderDateLong}
            </span>
          </div>
        )}

        {/* Name */}
        <h3 className="text-lg font-bold text-foreground">{listing.name}</h3>

        {/* Description */}
        {listing.description && (
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {listing.description}
          </p>
        )}

        {/* Price */}
        <p
          className="mt-2 text-2xl font-bold text-accent-foreground"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
        >
          ${listing.price.toFixed(2)}
        </p>

        {/* Tags row */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {fulfillmentLabel}
          </span>
          {listing.category_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-green-900/50 px-2.5 py-1 text-[11px] font-medium text-accent-foreground"
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

        {/* Action row */}
        {soldOut ? (
          <div className="glass-btn-pill mt-4 flex h-11 items-center justify-center text-sm font-semibold text-muted-foreground">
            Sold out
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            {/* Qty stepper */}
            <div className="glass-btn-pill flex items-center gap-1 !p-0">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:text-muted-foreground/40 active:scale-90 transition-transform"
              >
                <Minus size={16} />
              </button>
              <span className="w-7 text-center text-base font-semibold text-foreground">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty(Math.min(listing.quantity, qty + 1))}
                disabled={qty >= listing.quantity}
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:text-muted-foreground/40 active:scale-90 transition-transform"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Add to cart */}
            <button
              type="button"
              onClick={() => {
                onAddToCart(listing, qty);
                setQty(1);
              }}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
                cartQty > 0
                  ? "bg-green-800/60 border border-green-400/30"
                  : "bg-[#1B5E20] shadow-[0_0_16px_rgba(27,94,32,0.4)]"
              )}
            >
              <ShoppingCart size={15} />
              {cartQty > 0 ? `In Cart (${cartQty})` : "Add to cart"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
