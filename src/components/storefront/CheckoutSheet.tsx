"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  CreditCard,
  MapPin,
  Truck,
  AlertCircle,
} from "lucide-react";
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
import { useCurrentUser } from "@/hooks/use-current-user";

/** Formats a stored E.164 US phone (+13235550123) as (323) 555-0123. */
function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Format raw digits as the user types: "3235550123" → "(323) 555-0123". */
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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

/** Live quote response from /api/v1/uber/quote. Mirrors the
 *  payload that route returns (which itself maps Uber's
 *  DeliveryQuoteResp into client-friendly snake_case). */
interface DeliveryQuote {
  quote_id: string;
  fee_cents: number;
  currency: string;
  duration_minutes: number;
  pickup_duration_minutes: number;
  dropoff_eta: string;
  expires_at: string;
}

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; quote: DeliveryQuote }
  | { kind: "error"; message: string };

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
  const currentUser = useCurrentUser();
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("pickup");
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  // Structured dropoff for Uber Direct. We collect free-text in
  // `deliveryAddress` (for the order record + courier display) and
  // parse it client-side into city/state/zip for the Uber quote
  // call. Customer can also fill the structured fields directly
  // if the parser fails.
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffState, setDropoffState] = useState("TX");
  const [dropoffZip, setDropoffZip] = useState("");
  // Live Uber Direct quote — re-fetched on (debounced) address
  // change. NULL state hides the fee/ETA line.
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: "idle" });
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  // Guest contact info — minimal-friction model. We keep the name
  // field so the order feels personal to the creator (their inbox
  // reads "Maria's order", not "Customer 5310"). For notifications:
  // phone is REQUIRED on delivery (Uber's courier needs to call
  // the door); pickup accepts phone OR email, whichever the
  // customer prefers. Same pattern DoorDash + Uber Eats use.
  const [guestName, setGuestName] = useState("");
  const [guestPhoneRaw, setGuestPhoneRaw] = useState("");
  const guestPhoneDigits = guestPhoneRaw.replace(/\D/g, "");
  const [email, setEmail] = useState("");

  // Reset guest fields when the sheet closes so a stale entry doesn't
  // leak into the next purchase on a shared device.
  useEffect(() => {
    if (!open) {
      setGuestName("");
      setGuestPhoneRaw("");
      setEmail("");
    }
  }, [open]);

  const total = getCartTotal(items);

  /** Best-effort parse of the customer's free-text address into the
   *  city/state/zip the Uber quote API needs. Auto-populates the
   *  structured fields whenever the customer types or pastes a full
   *  address; they can also edit the structured fields directly. */
  const parseAddress = useCallback((raw: string) => {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return;
    const last = parts[parts.length - 1];
    const stateZip = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(last);
    if (stateZip) {
      setDropoffState(stateZip[1].toUpperCase());
      setDropoffZip(stateZip[2]);
      if (parts.length >= 3) setDropoffCity(parts[parts.length - 2]);
    } else if (/^\d{5}(?:-\d{4})?$/.test(last)) {
      setDropoffZip(last);
      const prev = parts[parts.length - 2] ?? "";
      const stateMatch = /^[A-Za-z]{2}$/.exec(prev);
      if (stateMatch) {
        setDropoffState(stateMatch[0].toUpperCase());
        if (parts.length >= 3) setDropoffCity(parts[parts.length - 3]);
      } else if (parts.length >= 2) {
        setDropoffCity(parts[parts.length - 2]);
      }
    } else if (parts.length >= 2) {
      setDropoffCity(parts[parts.length - 2]);
    }
  }, []);

  // Quote-fetch debouncer. Re-runs whenever a delivery-relevant
  // field changes; cancels in-flight fetches when the input
  // changes again before the response lands. Only fires when the
  // customer has typed enough to make the request meaningful
  // (street address + zip is the minimum we'll quote on).
  const quoteAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (fulfillment !== "delivery") {
      setQuoteState({ kind: "idle" });
      return;
    }
    if (items.length === 0) return;
    const street = deliveryAddress.trim();
    if (street.length < 5 || !dropoffZip || !/^\d{5}/.test(dropoffZip)) {
      setQuoteState({ kind: "idle" });
      return;
    }

    quoteAbortRef.current?.abort();
    const ac = new AbortController();
    quoteAbortRef.current = ac;
    setQuoteState({ kind: "loading" });

    // 400ms debounce — long enough to swallow typing bursts, short
    // enough that the customer doesn't feel a lag after they stop.
    const timer = setTimeout(async () => {
      // Manifest total is the sum of every cart line + selected
      // extras. Lets Uber size the delivery + maybe flag high-value
      // orders for extra-careful handling.
      const manifestTotalCents = items.reduce((sum, item) => {
        const plate = Math.round(item.listing.price * 100) * item.quantity;
        const extras = (item.selected_extras ?? []).reduce(
          (acc, e) => acc + e.price_cents * e.qty,
          0
        );
        return sum + plate + extras;
      }, 0);

      try {
        const res = await fetch("/api/v1/uber/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Quote the first cart line's listing — Uber needs a
            // pickup address, and the cart is per-creator so any
            // line's pickup_address resolves to the same kitchen.
            listing_id: items[0].listing.id,
            dropoff: {
              street_address: street,
              city: dropoffCity || "Houston",
              state: dropoffState || "TX",
              zip_code: dropoffZip,
            },
            manifest_total_value: manifestTotalCents,
          }),
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const json = await res.json();
        if (!res.ok) {
          // Uber's "no courier available" maps to our 503; treat
          // it as a graceful soft-fail so the UI can offer the
          // pickup fallback without screaming red.
          setQuoteState({
            kind: "error",
            message:
              json?.error ||
              "Delivery isn't available right now. Try pickup instead.",
          });
          return;
        }
        setQuoteState({ kind: "ok", quote: json.data as DeliveryQuote });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setQuoteState({
          kind: "error",
          message: "Couldn't reach the delivery service. Try pickup instead.",
        });
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [
    fulfillment,
    deliveryAddress,
    dropoffCity,
    dropoffState,
    dropoffZip,
    items,
  ]);

  const deliveryFeeDollars =
    quoteState.kind === "ok" ? quoteState.quote.fee_cents / 100 : 0;
  const needsAddress = fulfillment === "delivery" && deliveryAddress.trim().length < 5;
  // Contact validation for guest orders. Name is always required
  // (keeps the creator's inbox personal). Notification channel:
  //   - delivery → phone REQUIRED (Uber's courier needs a number
  //     to reach the customer at the door)
  //   - pickup   → phone OR email (one channel is enough; this
  //     removes the "I don't share my phone" friction for
  //     pickup-only orders)
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const phoneValid = guestPhoneDigits.length === 10;
  const guestFieldsValid =
    guestName.trim().length > 0 &&
    (fulfillment === "delivery" ? phoneValid : phoneValid || emailValid);
  // Delivery orders need an active quote — without it we can't
  // book a courier on the Stripe success webhook side. Pickup
  // orders skip this gate.
  const deliveryReady =
    fulfillment !== "delivery" || quoteState.kind === "ok";
  const canPlace =
    !needsAddress &&
    deliveryReady &&
    (!!currentUser || guestFieldsValid);

  const handlePlace = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      // No-OTP guest path — register an anon Supabase auth session
      // first so the checkout route's auth.getUser() resolves and we
      // get a real user.id for orders.member_id + messaging.
      let memberName: string;
      let memberPhone: string;

      if (!currentUser) {
        const trimmedName = guestName.trim();
        const trimmedEmail = email.trim();
        const anonRes = await fetch("/api/v1/auth/anon-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            // Phone may be empty on pickup orders (email-only flow).
            // The endpoint accepts null and uses email as the
            // notification channel instead.
            phone: guestPhoneDigits || null,
            email: trimmedEmail || null,
          }),
        });
        const anonJson = await anonRes.json();
        if (!anonRes.ok) {
          // Surface the server's error + code (anonymous_provider_disabled
          // is the most likely cause if the dashboard toggle hasn't been
          // flipped) so it's diagnosable from the toast.
          const code =
            typeof anonJson?.code === "string" ? ` [${anonJson.code}]` : "";
          toast.error(
            `${anonJson?.error || "Couldn't start your order. Try again."}${code}`
          );
          setPlacing(false);
          return;
        }
        memberName = (anonJson?.data?.display_name as string) ?? trimmedName;
        // Phone may be empty when the customer went email-only on a
        // pickup order. Downstream (checkout API + orders.member_phone)
        // accepts empty string and skips SMS notifications.
        memberPhone =
          (anonJson?.data?.phone as string) ??
          (guestPhoneDigits ? `+1${guestPhoneDigits}` : "");
      } else {
        memberName = currentUser.display_name;
        memberPhone = currentUser.phone;
      }

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
            // Selected add-ons (migration 018). Snapshot the
            // per-extra qty + name + price the customer is paying
            // for — server re-computes the subtotal from these to
            // prevent client-side tampering.
            extras: (item.selected_extras ?? [])
              .filter((e) => e.qty > 0 && e.name)
              .map((e) => ({
                name: e.name,
                price_cents: e.price_cents,
                qty: e.qty,
              })),
          })),
          member_name: memberName,
          member_phone: memberPhone,
          fulfillment_type: fulfillment,
          notes: notes.trim(),
          creator_handle: creatorHandle,
          customer_email: email.trim() || null,
          // Delivery-only fields. The checkout API uses these to:
          //   - persist dropoff_address on the order
          //   - add uber_fee_cents to the Stripe PaymentIntent
          //   - bake uber_quote_id into order metadata so the
          //     post-payment webhook can pass it to Uber's
          //     createDelivery call
          delivery_address:
            fulfillment === "delivery" ? deliveryAddress.trim() : null,
          dropoff: fulfillment === "delivery" ? {
            street_address: deliveryAddress.trim(),
            city: dropoffCity || "Houston",
            state: dropoffState || "TX",
            zip_code: dropoffZip,
          } : null,
          uber_quote_id:
            quoteState.kind === "ok" ? quoteState.quote.quote_id : null,
          uber_fee_cents:
            quoteState.kind === "ok" ? quoteState.quote.fee_cents : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || "Failed to create checkout");
      }

      // Also create local orders for demo tracking
      onPlaceOrder({
        memberName,
        memberPhone,
        fulfillmentType: fulfillment,
        notes: notes.trim(),
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress.trim() : null,
      });

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } catch (error) {
      console.error("Checkout error:", error);
      // Surface the server's real reason (creator not Connect-verified,
      // Stripe test/live mismatch, missing capability, etc.) instead of
      // a single opaque "try again" that makes every failure identical.
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Payment setup failed. Please try again.";
      toast.error(message);
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] text-white"
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
        className="rounded-t-3xl border-white/[0.22] text-white max-h-[85vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Order from {creatorName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto max-h-[60vh] pb-4">
          {/* Ordering-as panel.
              - Authed user: read-only summary (existing behavior, unchanged).
              - Anonymous (no OTP, A2P pending): inline name + phone inputs.
                These pass to /api/v1/auth/anon-customer on submit and become
                the order's member_name/member_phone. */}
          {currentUser ? (
            <div className="glass-card px-4 py-3">
              <p className="text-xs text-white/50">Ordering as</p>
              <p className="mt-0.5 text-sm font-medium text-white">
                {currentUser.display_name}
              </p>
              {currentUser.phone && (
                <p className="text-xs text-white/40">
                  {formatPhone(currentUser.phone)}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/50">
                Your contact info
              </p>
              <input
                type="text"
                value={guestName}
                onChange={(e) =>
                  setGuestName(e.target.value.slice(0, 40))
                }
                placeholder="Your name"
                autoFocus
                autoComplete="name"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={guestPhoneRaw}
                onChange={(e) =>
                  setGuestPhoneRaw(formatPhoneInput(e.target.value))
                }
                placeholder={
                  fulfillment === "delivery"
                    ? "Phone (required for delivery)"
                    : "Phone (for SMS updates)"
                }
                autoComplete="tel"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  fulfillment === "delivery"
                    ? "Email (optional, for receipt)"
                    : "Email (or use phone above)"
                }
                autoComplete="email"
                inputMode="email"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
              <p className="text-xs text-white/35">
                {fulfillment === "delivery"
                  ? "The courier and creator will reach you via phone."
                  : "Pick one — we'll send order updates there."}
              </p>
            </div>
          )}

          {/* Email — optional add-on for authed users (they may
              not have one on file). Hidden for guests because the
              contact-info block above already collects it. */}
          {currentUser && (
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional, for receipt)"
                autoComplete="email"
                inputMode="email"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
            </div>
          )}

          {/* Fulfillment */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              How do you want it?
            </label>
            <div className="glass-segment flex gap-1 p-1">
              {FULFILLMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFulfillment(opt.value)}
                  className={cn(
                    "glass-segment-item flex-1 py-2.5 text-sm font-medium transition-all active:scale-95",
                    fulfillment === opt.value
                      ? "bg-green-900/50 text-green-300 border border-green-400/30 shadow-[0_0_12px_rgba(27,94,32,0.30)]"
                      : "text-white/50"
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
            <div className="space-y-2">
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Delivery address *
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  parseAddress(e.target.value);
                }}
                placeholder="123 Main St, Houston, TX 77001"
                className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
              {/* Structured fields — auto-populated by the parser
                  above, but the customer can also fix them
                  directly if the parse went sideways. Uber's
                  quote API needs city/state/zip explicitly. */}
              <div className="grid grid-cols-[1fr_60px_100px] gap-2">
                <input
                  type="text"
                  value={dropoffCity}
                  onChange={(e) => setDropoffCity(e.target.value)}
                  placeholder="City"
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                />
                <input
                  type="text"
                  value={dropoffState}
                  onChange={(e) =>
                    setDropoffState(e.target.value.slice(0, 2).toUpperCase())
                  }
                  placeholder="ST"
                  className="glass-input rounded-xl px-3 py-2.5 text-xs uppercase text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={dropoffZip}
                  onChange={(e) =>
                    setDropoffZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  placeholder="ZIP"
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                />
              </div>
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
                          parseAddress(data.display_name);
                          toast.success("Address found!");
                        }
                      } catch {
                        toast.error("Could not resolve location");
                      }
                    },
                    () => toast.error("Location access denied")
                  );
                }}
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
              >
                <MapPin size={12} />
                Use my location
              </button>

              {/* Live Uber Direct quote — fee + ETA. Skinny
                  status row that morphs between loading / OK /
                  soft-fail states. */}
              {quoteState.kind === "loading" && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs text-white/55">
                  <Loader2 size={12} className="animate-spin" />
                  Checking delivery availability…
                </div>
              )}
              {quoteState.kind === "ok" && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-900/[0.18] px-3 py-2.5">
                  <Truck size={14} className="shrink-0 text-emerald-300" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-emerald-200">
                      Delivery available
                    </p>
                    <p className="text-emerald-300/80">
                      Arrives in ~{quoteState.quote.duration_minutes} min
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-200">
                    ${(quoteState.quote.fee_cents / 100).toFixed(2)}
                  </p>
                </div>
              )}
              {quoteState.kind === "error" && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-900/[0.18] px-3 py-2.5">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-300" />
                  <div className="flex-1 text-xs text-amber-100/90">
                    {quoteState.message}
                    {" "}
                    <button
                      type="button"
                      onClick={() => setFulfillment("pickup")}
                      className="ml-1 underline-offset-2 hover:underline font-semibold text-amber-100"
                    >
                      Switch to pickup
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-3">
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
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 resize-none"
            />
          </div>

          {/* Order summary — per-line plate row + a sub-list of any
              selected extras with their per-row subtotal so the
              customer can see exactly what they're paying for
              before submitting. */}
          <div className="glass-card p-3 space-y-2">
            {items.map((item) => {
              const extras = item.selected_extras ?? [];
              return (
                <div key={item.listing.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">
                      {item.listing.name} × {item.quantity}
                    </span>
                    <span className="text-white">
                      ${(item.listing.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  {extras.map((ex) => (
                    <div
                      key={ex.name}
                      className="flex justify-between pl-3 text-[11px]"
                    >
                      <span className="text-white/45">
                        + {ex.qty} {ex.name}
                      </span>
                      <span className="text-white/65">
                        ${((ex.price_cents / 100) * ex.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Delivery fee — surfaced as its own line in the
                summary when an Uber quote is live so the customer
                sees the breakdown, not just a higher final number. */}
            {quoteState.kind === "ok" && (
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Delivery (Uber)</span>
                <span className="text-white">
                  ${deliveryFeeDollars.toFixed(2)}
                </span>
              </div>
            )}
            <div className="h-px bg-white/[0.08]" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-white">Total</span>
              <span
                className="text-lg font-bold text-green-300"
                style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
              >
                ${(total + deliveryFeeDollars).toFixed(2)}
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
                : "glass-btn-pill cursor-not-allowed opacity-50"
            )}
          >
            {placing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard size={16} className="mr-1.5" />
                Pay ${(total + deliveryFeeDollars).toFixed(2)}
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
