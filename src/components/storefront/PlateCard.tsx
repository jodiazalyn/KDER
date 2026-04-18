"use client";

import { useState } from "react";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import type { Listing } from "@/types";
import { cn } from "@/lib/utils";

interface PlateCardProps {
  listing: Listing;
  cartQty: number;
  onAddToCart: (listing: Listing, qty: number) => void;
}

export function PlateCard({ listing, cartQty, onAddToCart }: PlateCardProps) {
  const [qty, setQty] = useState(1);
  const photo = listing.photos[0] || "/icons/kder-logo.png";
  const soldOut = listing.quantity <= 0;

  const fulfillmentLabel =
    listing.fulfillment_type === "both"
      ? "Pickup & Delivery"
      : listing.fulfillment_type === "pickup"
        ? "Pickup"
        : "Delivery";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] transition-opacity",
        soldOut && "opacity-60"
      )}
    >
      {/* Hero photo */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={photo}
          alt={listing.name}
          className="h-full w-full object-cover"
        />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-md">
              Sold out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <h3 className="text-lg font-bold text-white">{listing.name}</h3>

        {/* Description */}
        {listing.description && (
          <p className="mt-1 line-clamp-3 text-sm text-white/60">
            {listing.description}
          </p>
        )}

        {/* Price */}
        <p
          className="mt-2 text-2xl font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
        >
          ${listing.price.toFixed(2)}
        </p>

        {/* Tags row */}
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

        {/* Action row */}
        {soldOut ? (
          <div className="mt-4 flex h-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-white/40">
            Sold out
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            {/* Qty stepper */}
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
                onClick={() => setQty(Math.min(listing.quantity, qty + 1))}
                disabled={qty >= listing.quantity}
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 disabled:text-white/20 active:scale-90 transition-transform"
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
