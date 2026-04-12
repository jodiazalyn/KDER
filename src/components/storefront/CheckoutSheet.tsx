"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CartItem } from "@/lib/cart-store";
import { getCartTotal } from "@/lib/cart-store";
import type { FulfillmentType } from "@/types";
import { cn } from "@/lib/utils";

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  creatorHandle: string;
  onPlaceOrder: (details: OrderDetails) => void;
}

export interface OrderDetails {
  memberName: string;
  memberPhone: string;
  fulfillmentType: FulfillmentType;
  notes: string;
}

const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

export function CheckoutSheet({
  open,
  onOpenChange,
  items,
  creatorHandle,
  onPlaceOrder,
}: CheckoutSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("pickup");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  const total = getCartTotal(items);
  const canPlace = name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10;

  const handlePlace = async () => {
    setPlacing(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800));
    onPlaceOrder({ memberName: name.trim(), memberPhone: phone, fulfillmentType: fulfillment, notes: notes.trim() });
    setPlacing(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
        >
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/40">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Order Placed!</h2>
            <p className="text-center text-sm text-white/50">
              Your order has been sent to @{creatorHandle}. They&apos;ll confirm it shortly.
            </p>
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                onOpenChange(false);
              }}
              className="mt-4 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-h-[85vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Checkout</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto max-h-[60vh] pb-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              Your name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First Last"
              className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/30 focus:border-green-400/60 focus:outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              Phone number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/30 focus:border-green-400/60 focus:outline-none"
            />
          </div>

          {/* Fulfillment */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              How do you want it?
            </label>
            <div className="flex gap-2">
              {FULFILLMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFulfillment(opt.value)}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all",
                    fulfillment === opt.value
                      ? "bg-green-900/50 text-green-300 border border-green-400/30"
                      : "bg-white/[0.06] text-white/50 border border-white/[0.08]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              Special instructions (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra sauce, no onions, etc."
              rows={2}
              className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-400/60 focus:outline-none resize-none"
            />
          </div>

          {/* Order summary */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 space-y-2">
            {items.map((item) => (
              <div key={item.listing.id} className="flex justify-between text-xs">
                <span className="text-white/60">
                  {item.listing.name} × {item.quantity}
                </span>
                <span className="text-white">
                  ${(item.listing.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="h-px bg-white/[0.08]" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-white">Total</span>
              <span
                className="text-lg font-bold text-green-300"
                style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
              >
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Place Order */}
        <div className="border-t border-white/[0.08] pt-4 pb-6">
          <button
            type="button"
            onClick={handlePlace}
            disabled={!canPlace || placing}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-full text-sm font-bold text-white transition-all active:scale-95",
              canPlace && !placing
                ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
                : "bg-white/10 cursor-not-allowed opacity-50"
            )}
          >
            {placing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `Place Order · $${total.toFixed(2)}`
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
