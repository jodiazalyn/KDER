"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";
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
  creatorName: string;
  onPlaceOrder: (details: OrderDetails) => void;
}

export interface OrderDetails {
  memberName: string;
  memberPhone: string;
  fulfillmentType: FulfillmentType;
  notes: string;
  deliveryAddress: string | null;
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
  creatorName,
  onPlaceOrder,
}: CheckoutSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("pickup");
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  const total = getCartTotal(items);
  const needsAddress = fulfillment === "delivery" && deliveryAddress.trim().length < 5;
  const canPlace = name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10 && !needsAddress;

  const handlePlace = async () => {
    setPlacing(true);
    try {
      // Create Stripe Checkout Session
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            listing_id: item.listing.id,
            name: item.listing.name,
            price: item.listing.price,
            quantity: item.quantity,
            photo: item.listing.photos[0] || null,
          })),
          member_name: name.trim(),
          member_phone: phone,
          fulfillment_type: fulfillment,
          notes: notes.trim(),
          creator_handle: creatorHandle,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || "Failed to create checkout");
      }

      // Also create local orders for demo tracking
      onPlaceOrder({
        memberName: name.trim(),
        memberPhone: phone,
        fulfillmentType: fulfillment,
        notes: notes.trim(),
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress.trim() : null,
      });

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Payment setup failed. Please try again.");
      setPlacing(false);
    }
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
              Your order has been sent to {creatorName}. They&apos;ll confirm it shortly.
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
          <SheetTitle className="text-white">Order from {creatorName}</SheetTitle>
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
          {/* Delivery address or Pickup note */}
          {fulfillment === "delivery" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Delivery address *
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="123 Main St, Houston, TX 77001"
                className="w-full rounded-xl border border-white/[0.15] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-400/50 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error("Location not supported on this device");
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      try {
                        const res = await fetch(
                          `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
                        );
                        const data = await res.json();
                        if (data.display_name) {
                          setDeliveryAddress(data.display_name);
                          toast.success("Address found!");
                        }
                      } catch {
                        toast.error("Could not resolve location");
                      }
                    },
                    () => toast.error("Location access denied")
                  );
                }}
                className="mt-2 flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
              >
                <MapPin size={12} />
                Use my location
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
              <p className="text-xs text-white/50">
                The creator&apos;s pickup address will be sent to your phone via SMS after they confirm your order.
              </p>
            </div>
          )}

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
              <>
                <CreditCard size={16} className="mr-1.5" />
                Pay ${total.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
