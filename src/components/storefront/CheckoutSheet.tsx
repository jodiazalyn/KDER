"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  CreditCard,
  MapPin,
  Truck,
  AlertCircle,
  Tag,
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

/** US state full-name → USPS abbreviation. Nominatim returns the full
 *  state name ("Texas"), but the Uber quote API + dropoff fields want the
 *  2-letter code. */
const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI",
  idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** Resolve a 2-letter state code from Nominatim's address object, preferring
 *  the ISO3166-2 code ("US-TX" → "TX") and falling back to the name map. */
function resolveStateCode(addr: Record<string, unknown>): string | null {
  const iso = addr["ISO3166-2-lvl4"];
  if (typeof iso === "string" && iso.includes("-")) {
    const code = iso.split("-").pop();
    if (code && code.length === 2) return code.toUpperCase();
  }
  const state = addr.state;
  if (typeof state === "string") {
    const abbr = US_STATE_ABBR[state.toLowerCase()];
    if (abbr) return abbr;
  }
  return null;
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
  /** Flat self-delivery fee in cents (migration 025). 0 = free delivery.
   *  Shown to the customer the moment they pick "Delivery". */
  deliveryFeeCents: number;
  /** Creator's service-area ZIPs. Delivery is gated to these when the list
   *  is non-empty; an empty list means the creator hasn't restricted a
   *  service area, so any ZIP is accepted. */
  serviceZips: string[];
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
  deliveryFeeCents,
  serviceZips,
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
  // True while the browser geolocation prompt + reverse-geocode is in
  // flight, so the "Use my location" button can show a spinner and lock
  // out double-taps.
  const [locating, setLocating] = useState(false);
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
  // Promo code (migration 024). Validated + applied server-side at
  // checkout; we just collect the raw string here and pass it along.
  const [promoCode, setPromoCode] = useState("");

  // Reset guest fields when the sheet closes so a stale entry doesn't
  // leak into the next purchase on a shared device.
  useEffect(() => {
    if (!open) {
      setGuestName("");
      setGuestPhoneRaw("");
      setEmail("");
      setPromoCode("");
    }
  }, [open]);

  // Prefill the receipt email from the authed user's account email so
  // they don't retype it — email is now required for every order (the
  // receipt is never optional). Only seed when the field is still empty
  // so we don't clobber a manual edit. Guests type their own below.
  useEffect(() => {
    if (open && currentUser?.email) {
      setEmail((prev) => prev || currentUser.email);
    }
  }, [open, currentUser?.email]);

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

  /** "Use my location": ask the browser for GPS, then reverse-geocode into
   *  STRUCTURED fields. We request addressdetails so we can populate
   *  city/state/zip directly — the old path stuffed Nominatim's verbose
   *  `display_name` (which ends in "…, United States") into one box, so the
   *  parser never found the zip and the quote never fired. */
  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Location not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          );
          if (!res.ok) throw new Error(`geocode ${res.status}`);
          const data = await res.json();
          const addr = (data?.address ?? {}) as Record<string, unknown>;

          const houseNumber =
            typeof addr.house_number === "string" ? addr.house_number : "";
          const road = typeof addr.road === "string" ? addr.road : "";
          const street = [houseNumber, road].filter(Boolean).join(" ").trim();

          const city =
            (typeof addr.city === "string" && addr.city) ||
            (typeof addr.town === "string" && addr.town) ||
            (typeof addr.village === "string" && addr.village) ||
            (typeof addr.suburb === "string" && addr.suburb) ||
            (typeof addr.county === "string" && addr.county) ||
            "";
          const stateCode = resolveStateCode(addr);
          const zip =
            typeof addr.postcode === "string"
              ? addr.postcode.replace(/\D/g, "").slice(0, 5)
              : "";

          // Use the clean street line as the editable address; fall back to
          // the verbose display_name only if we couldn't build a street.
          const streetLine =
            street || (typeof data?.display_name === "string" ? data.display_name : "");
          if (streetLine) setDeliveryAddress(streetLine);
          if (city) setDropoffCity(city);
          if (stateCode) setDropoffState(stateCode);
          if (zip) setDropoffZip(zip);

          if (zip) {
            toast.success("Address found!");
          } else {
            // Got a fix but couldn't pin a zip — let them finish by hand
            // rather than silently failing.
            toast.message("Got your location — please add your ZIP to finish.");
          }
        } catch {
          toast.error("Could not resolve location. Enter your address manually.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied — enable it or type your address."
            : "Couldn't get your location. Enter your address manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Self-delivery (migration 025) ──────────────────────────────
  // Uber Direct isn't live, so "Delivery" means the creator drives the
  // order themselves. There's no courier quote to fetch — the fee is a
  // flat per-storefront rate the creator set, passed in as
  // `deliveryFeeCents`, and delivery is gated to their service-area ZIPs.
  const deliveryFeeDollars =
    fulfillment === "delivery" ? deliveryFeeCents / 100 : 0;
  const zipValid = /^\d{5}$/.test(dropoffZip);
  // Empty serviceZips = creator hasn't restricted an area → accept any ZIP.
  const zipInServiceArea =
    serviceZips.length === 0 || serviceZips.includes(dropoffZip);
  const needsAddress = fulfillment === "delivery" && deliveryAddress.trim().length < 5;
  // Contact validation. Email is ALWAYS required now — every order sends
  // a receipt on confirmation + completion, so we must capture a valid
  // address for both guests and authed users. Name is required for guests
  // (keeps the creator's inbox personal). Phone is additionally required
  // on delivery so the creator can reach the customer at the door.
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const phoneValid = guestPhoneDigits.length === 10;
  const guestFieldsValid =
    guestName.trim().length > 0 &&
    emailValid &&
    (fulfillment === "delivery" ? phoneValid : true);
  // Self-delivery orders need a complete, in-service-area address — the
  // creator has to be able to drive to it. Pickup orders skip this gate.
  const deliveryReady =
    fulfillment !== "delivery" ||
    (deliveryAddress.trim().length >= 5 && zipValid && zipInServiceArea);
  const canPlace =
    !needsAddress &&
    deliveryReady &&
    emailValid &&
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
          // Promo code (migration 024). Server validates against the
          // creator's own code list and recomputes the discount — an
          // invalid/expired code comes back as a 400 surfaced via toast.
          discount_code: promoCode.trim() || null,
          // Delivery fields. Self-delivery (migration 025): the creator
          // drives, so there's no Uber quote — we send the structured
          // dropoff (persisted on the order + used for the ZIP gate) and
          // leave uber_* null, which is how the checkout API detects
          // self-delivery and applies the creator's flat delivery fee.
          delivery_address:
            fulfillment === "delivery" ? deliveryAddress.trim() : null,
          dropoff: fulfillment === "delivery" ? {
            street_address: deliveryAddress.trim(),
            city: dropoffCity || "Houston",
            state: dropoffState || "TX",
            zip_code: dropoffZip,
          } : null,
          uber_quote_id: null,
          uber_fee_cents: null,
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
          className="rounded-t-3xl border-border text-foreground"
        >
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Order Placed!</h2>
            <p className="text-center text-sm text-muted-foreground">
              Your order has been sent to {creatorName}. They&apos;ll confirm it shortly.
            </p>
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                onOpenChange(false);
              }}
              className="mt-4 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
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
        className="rounded-t-3xl border-border text-foreground max-h-[85vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Order from {creatorName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto max-h-[60vh] pb-4">
          {/* Ordering-as panel.
              - Authed user: read-only summary (existing behavior, unchanged).
              - Anonymous (no OTP, A2P pending): inline name + phone inputs.
                These pass to /api/v1/auth/anon-customer on submit and become
                the order's member_name/member_phone. */}
          {currentUser ? (
            <div className="glass-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Ordering as</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {currentUser.display_name}
              </p>
              {currentUser.phone && (
                <p className="text-xs text-muted-foreground">
                  {formatPhone(currentUser.phone)}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
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
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (required, for your receipt)"
                autoComplete="email"
                inputMode="email"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground">
                {fulfillment === "delivery"
                  ? "We'll email your receipt; the creator will call your phone to drop off."
                  : "We'll email your receipt and order updates here."}
              </p>
            </div>
          )}

          {/* Email — required for authed users too. It's prefilled from
              their account email when one is on file (see the effect
              above); if not, they must supply one so the receipt can be
              sent. Guests collect it in the contact block above. */}
          {currentUser && (
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (required, for your receipt)"
                autoComplete="email"
                inputMode="email"
                className="glass-input h-12 w-full rounded-xl px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              {!emailValid && (
                <p className="mt-1 text-xs text-muted-foreground">
                  We&apos;ll email your receipt here.
                </p>
              )}
            </div>
          )}

          {/* Fulfillment */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
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
                      ? "!bg-primary/15 text-primary !border-primary/30 border"
                      : "text-muted-foreground"
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
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
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
                className="glass-input w-full rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <input
                  type="text"
                  value={dropoffState}
                  onChange={(e) =>
                    setDropoffState(e.target.value.slice(0, 2).toUpperCase())
                  }
                  placeholder="ST"
                  className="glass-input rounded-xl px-3 py-2.5 text-xs uppercase text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={dropoffZip}
                  onChange={(e) =>
                    setDropoffZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  placeholder="ZIP"
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <button
                type="button"
                onClick={handleUseLocation}
                disabled={locating}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <MapPin size={12} />
                )}
                {locating ? "Locating…" : "Use my location"}
              </button>

              {/* Self-delivery status (migration 025). The creator drives
                  the order themselves, so there's no live courier quote —
                  we show their flat delivery fee up-front and, once the
                  address is complete, confirm it's in their service area
                  (or flag it if not). */}
              {!zipInServiceArea && zipValid ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="flex-1 text-xs text-amber-700 dark:text-amber-100/90">
                    {creatorName} doesn&apos;t deliver to {dropoffZip} yet.
                    {" "}
                    <button
                      type="button"
                      onClick={() => setFulfillment("pickup")}
                      className="ml-1 underline-offset-2 hover:underline font-semibold text-amber-700 dark:text-amber-100"
                    >
                      Switch to pickup
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                  <Truck size={14} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-200">
                      {creatorName} delivers it to you
                    </p>
                    <p className="text-emerald-600/80 dark:text-emerald-300/80">
                      {deliveryFeeCents > 0
                        ? "Flat delivery fee — added to your total below."
                        : "Free delivery in their service area."}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
                    {deliveryFeeCents > 0
                      ? `$${deliveryFeeDollars.toFixed(2)}`
                      : "Free"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-3">
              <p className="text-xs text-muted-foreground">
                The creator&apos;s pickup address will be sent to your phone via SMS after they confirm your order.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Special instructions (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra sauce, no onions, etc."
              rows={2}
              className="glass-input w-full px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 resize-none"
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
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {item.listing.name} × {item.quantity}
                    </span>
                    <span className="shrink-0 text-foreground">
                      ${(item.listing.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  {extras.map((ex) => (
                    <div
                      key={ex.name}
                      className="flex justify-between gap-2 pl-3 text-[11px]"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        + {ex.qty} {ex.name}
                      </span>
                      <span className="shrink-0 text-foreground/80">
                        ${((ex.price_cents / 100) * ex.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Delivery fee — surfaced as its own summary line when the
                customer picks delivery so they see the breakdown, not just
                a higher final number. Free delivery shows "Free". */}
            {fulfillment === "delivery" && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-foreground">
                  {deliveryFeeCents > 0
                    ? `$${deliveryFeeDollars.toFixed(2)}`
                    : "Free"}
                </span>
              </div>
            )}
            {/* Promo code (migration 024). The discount is applied +
                validated server-side, so the final reduced amount shows
                on the Stripe checkout page and receipt. We keep the
                input compact here; an invalid code surfaces as a toast
                after the customer hits Pay. */}
            <div className="flex items-center gap-2 pt-0.5">
              <Tag size={14} className="shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={promoCode}
                onChange={(e) =>
                  setPromoCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)
                  )
                }
                placeholder="Promo code"
                autoComplete="off"
                autoCapitalize="characters"
                className="glass-input h-9 flex-1 rounded-lg px-3 text-xs font-semibold tracking-wide text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-lg font-bold text-primary">
                ${(total + deliveryFeeDollars).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Place Order */}
        <div className="border-t border-border pt-4 pb-6">
          <button
            type="button"
            onClick={handlePlace}
            disabled={!canPlace || placing}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-full text-sm font-bold text-white transition-all active:scale-95",
              canPlace && !placing
                ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
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
