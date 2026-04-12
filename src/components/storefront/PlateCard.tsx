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

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] overflow-hidden backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]">
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={photo}
          alt={listing.name}
          className="h-full w-full object-cover"
        />
        {/* Fulfillment pill */}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {listing.fulfillment_type === "both"
            ? "Pickup & Delivery"
            : listing.fulfillment_type === "pickup"
              ? "Pickup"
              : "Delivery"}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-white truncate">{listing.name}</h3>
        {listing.description && (
          <p className="mt-0.5 text-xs text-white/40 line-clamp-2">
            {listing.description}
          </p>
        )}

        <p
          className="mt-1.5 text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
        >
          ${listing.price.toFixed(2)}
        </p>

        {/* Category tags */}
        {listing.category_tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {listing.category_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-green-900/30 px-2 py-0.5 text-[9px] font-medium text-green-300/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Qty + Add to cart */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 disabled:text-white/20"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-medium text-white">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(Math.min(listing.quantity, qty + 1))}
              disabled={qty >= listing.quantity}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 disabled:text-white/20"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onAddToCart(listing, qty);
              setQty(1);
            }}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
              cartQty > 0
                ? "bg-green-800/60 border border-green-400/30"
                : "bg-[#1B5E20] shadow-[0_0_16px_rgba(27,94,32,0.4)]"
            )}
          >
            <ShoppingCart size={14} />
            {cartQty > 0 ? `In Cart (${cartQty})` : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
