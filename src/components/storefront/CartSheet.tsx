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
  /** Adjust the qty of a single extra inside a cart line. qty === 0
   *  removes the extra entry but leaves the plate line in place. */
  onUpdateExtraQty?: (
    listingId: string,
    extraName: string,
    qty: number
  ) => void;
  onCheckout: () => void;
}

export function CartSheet({
  open,
  onOpenChange,
  items,
  onUpdateQty,
  onRemove,
  onUpdateExtraQty,
  onCheckout,
}: CartSheetProps) {
  const total = getCartTotal(items);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] text-white max-h-[80vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            Your Cart ({items.length} {items.length === 1 ? "item" : "items"})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[50vh] pb-4">
          {items.map((item) => {
            const extras = item.selected_extras ?? [];
            // Per-line subtotal: plate × qty + Σ extras
            const extrasSubtotalCents = extras.reduce(
              (sum, e) => sum + e.price_cents * e.qty,
              0
            );
            const lineTotal =
              item.listing.price * item.quantity +
              extrasSubtotalCents / 100;
            return (
              <div
                key={item.listing.id}
                className="glass-card p-3"
              >
                <div className="flex items-center gap-3">
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
                      ${lineTotal.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQty(item.listing.id, item.quantity - 1)
                      }
                      className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/60 active:scale-90 transition-transform"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQty(item.listing.id, item.quantity + 1)
                      }
                      className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/60 active:scale-90 transition-transform"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(item.listing.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-red-400/60 hover:bg-red-500/10 hover:text-red-400 active:scale-90 transition-all"
                    aria-label={`Remove ${item.listing.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Selected extras — one row each, with their own
                    -/+ steppers. Setting qty to 0 drops the extra
                    (handled by cart-store). Hidden when the line has
                    no extras so the cart stays clean. */}
                {extras.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                    {extras.map((ex) => (
                      <li
                        key={ex.name}
                        className="flex items-center gap-2 pl-1"
                      >
                        <span className="text-xs text-white/55">+</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-white/75">
                          {ex.name}
                          {ex.price_cents > 0 && (
                            <span className="ml-1 text-white/40">
                              · ${(ex.price_cents / 100).toFixed(
                                ex.price_cents % 100 === 0 ? 0 : 2
                              )}
                            </span>
                          )}
                        </span>
                        {onUpdateExtraQty && (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExtraQty(
                                  item.listing.id,
                                  ex.name,
                                  ex.qty - 1
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.05] active:scale-90 transition-transform"
                              aria-label={`Decrease ${ex.name}`}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center text-xs font-medium tabular-nums">
                              {ex.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExtraQty(
                                  item.listing.id,
                                  ex.name,
                                  ex.qty + 1
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.05] active:scale-90 transition-transform"
                              aria-label={`Increase ${ex.name}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
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
