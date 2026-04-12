"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CartItem } from "@/lib/cart-store";
import { getCartTotal } from "@/lib/cart-store";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onUpdateQty: (listingId: string, qty: number) => void;
  onRemove: (listingId: string) => void;
  onCheckout: () => void;
}

export function CartSheet({
  open,
  onOpenChange,
  items,
  onUpdateQty,
  onRemove,
  onCheckout,
}: CartSheetProps) {
  const total = getCartTotal(items);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-h-[80vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            Your Cart ({items.length} {items.length === 1 ? "item" : "items"})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[50vh] pb-4">
          {items.map((item) => (
            <div
              key={item.listing.id}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"
            >
              <img
                src={item.listing.photos[0] || "/icons/kder-logo.png"}
                alt={item.listing.name}
                className="h-14 w-14 rounded-xl object-cover"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {item.listing.name}
                </p>
                <p className="text-xs text-green-300">
                  ${(item.listing.price * item.quantity).toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateQty(item.listing.id, item.quantity - 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateQty(item.listing.id, item.quantity + 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50"
                >
                  <Plus size={12} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.listing.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-red-400/60 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Subtotal + Checkout */}
        <div className="border-t border-white/[0.08] pt-4 pb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Subtotal</span>
            <span
              className="text-xl font-bold text-green-300"
              style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }}
            >
              ${total.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
          >
            Proceed to Checkout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
