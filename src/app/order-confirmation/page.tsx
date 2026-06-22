"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Truck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { clearCart } from "@/lib/cart-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { OrderExtrasList } from "@/components/orders/OrderExtrasList";
import { OrderMessages } from "@/components/orders/OrderMessages";
import { PickupDistance } from "@/components/orders/PickupDistance";
import { OrderReceiptReview } from "@/components/orders/OrderReceiptReview";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";
import { cn } from "@/lib/utils";

type OrderStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "completed"
  | "declined"
  | "cancelled";

interface OrderResponse {
  id: string;
  status: OrderStatus;
  quantity: number;
  total_amount: number;
  fulfillment_type: "pickup" | "delivery" | "both";
  delivery_address: string | null;
  pickup_address: string | null;
  /** Uber Direct tracking (Phase 2 — migration 019). Only set on
   *  delivery orders that have been booked. The order API
   *  returns these directly when available. */
  uber_tracking_url?: string | null;
  uber_status?:
    | "pending"
    | "pickup"
    | "pickup_complete"
    | "dropoff"
    | "delivered"
    | "canceled"
    | "returned"
    | null;
  /** Booking-failure reason (migration 022). Set when the Stripe
   *  webhook's courier-booking call threw. Lets the page show a real
   *  error instead of an indefinite "Booking your courier…" spinner.
   *  Cleared to null once a booking succeeds. */
  uber_booking_error?: string | null;
  listing_name: string;
  listing_photo: string | null;
  creator_member_id: string | null;
  creator_display_name: string | null;
  /** Customer receipt-confirmation state (migration 021). Set once the
   *  customer confirms they received the order (or reported a problem). */
  receipt_status?: "received" | "problem" | null;
  received_confirmed_at?: string | null;
  /** Snapshot of cart items at checkout (migration 018). Each row's
   *  optional `extras` field is the customer's add-on picks. */
  items?: Array<{
    listing_id: string;
    name: string;
    price: number;
    quantity: number;
    photo: string | null;
    extras?: Array<{ name: string; price_cents: number; qty: number }>;
  }>;
}

const TERMINAL_STATUSES: OrderStatus[] = [
  "completed",
  "declined",
  "cancelled",
];

const POLL_INTERVAL_MS = 12_000;

function OrderConfirmationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id");
  const handle = searchParams.get("handle");
  const sessionId = searchParams.get("session_id");

  const currentUser = useCurrentUser();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "notfound">(
    "loading"
  );
  const [showBanner, setShowBanner] = useState(false);
  // Bumping this re-runs the fetch effect — used to immediately reflect
  // a customer receipt confirmation without waiting for the next poll.
  const [refreshKey, setRefreshKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Coachmark anchor for the StatusTracker timeline. First-time tip
  // explains that customers will get SMS updates as the order moves
  // through the lifecycle.
  const statusTrackerRef = useRef<HTMLDivElement>(null);

  // Clear the creator-scoped cart on first paint of the confirmation page.
  // (Intentionally not cleared at Pay time so customers backing out of Stripe
  // retain their selection.)
  useEffect(() => {
    if (handle) clearCart(handle);
  }, [handle]);

  // Decide whether to show the "Payment Successful!" banner.
  // Show once per order id — subsequent visits to the same URL skip it.
  // Defer setState via setTimeout(0) to satisfy React 19's
  // react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!orderId || typeof window === "undefined") return;
    const key = `kder_order_seen_${orderId}`;
    const alreadySeen = sessionStorage.getItem(key);
    if (!alreadySeen) {
      const t = setTimeout(() => setShowBanner(true), 0);
      sessionStorage.setItem(key, "1");
      return () => clearTimeout(t);
    }
  }, [orderId]);

  // Fetch the order + start polling until a terminal status.
  useEffect(() => {
    if (!orderId) {
      // Deferred to satisfy react-hooks/set-state-in-effect.
      const t = setTimeout(() => setLoadState("error"), 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/v1/orders/${orderId}`);
        if (cancelled) return;

        if (res.status === 401) {
          const next = encodeURIComponent(
            `/order-confirmation?order_id=${orderId}`
          );
          router.replace(`/signup?next=${next}`);
          return;
        }

        if (res.status === 404) {
          setLoadState("notfound");
          return;
        }

        if (!res.ok) {
          setLoadState("error");
          return;
        }

        const json = await res.json();
        const fetched = json?.data?.order as OrderResponse | undefined;
        if (!fetched) {
          setLoadState("error");
          return;
        }
        setOrder(fetched);
        setLoadState("ready");

        // Stop polling once the order is in a terminal state.
        if (TERMINAL_STATUSES.includes(fetched.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    };

    fetchOnce();
    pollRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [orderId, router, refreshKey]);

  if (loadState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <p className="text-sm text-white/50">Loading your order…</p>
      </main>
    );
  }

  if (loadState === "notfound" || loadState === "error" || !order) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 mb-4">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white">
          {loadState === "notfound"
            ? "We couldn't find that order"
            : "Couldn't load the order"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          {loadState === "notfound"
            ? "The link may be incorrect, or the order may belong to another account."
            : "Check your connection and try again."}
        </p>
        <Link
          href="/"
          className="glass-btn-pill mt-6 flex h-11 items-center justify-center px-6 text-sm font-bold text-white active:scale-95 transition-all"
        >
          Back to KDER
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 pb-20 pt-6">
      <div className="mx-auto max-w-lg space-y-5">
        {/* One-time success banner */}
        {showBanner && (
          <div className="glass-card flex items-start gap-3 border-green-400/[0.30] bg-green-900/[0.20] p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-900/60">
              <CheckCircle2 size={22} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-200">
                Payment Successful!
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                Your order is placed. Track its progress below.
              </p>
              {sessionId && (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-white/25">
                  Confirmation · {sessionId.slice(-8)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowBanner(false)}
              className="text-xs text-white/40 hover:text-white/70"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header — creator name + order id */}
        <div>
          <h1 className="text-2xl font-black text-white">Your order</h1>
          <p className="mt-1 text-sm text-white/50">
            {order.creator_display_name ? (
              <>
                From{" "}
                <span className="text-green-300">
                  {order.creator_display_name}
                </span>
              </>
            ) : (
              "From your creator"
            )}{" "}
            <span className="text-white/25">
              · #{order.id.slice(0, 8)}
            </span>
          </p>
        </div>

        {/* Status tracker */}
        <div ref={statusTrackerRef}>
          <StatusTracker order={order} />
        </div>

        {/* Customer close-out: confirm receipt (or report a problem),
            then leave an optional star review. Only renders once the
            creator has fulfilled the order. */}
        <OrderReceiptReview
          orderId={order.id}
          status={order.status}
          receiptStatus={order.receipt_status ?? null}
          onConfirmed={() => setRefreshKey((k) => k + 1)}
        />

        {/* Order summary card */}
        <div className="glass-card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">
            Order summary
          </p>
          <div className="flex gap-3">
            {order.listing_photo ? (
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/10">
                <Image
                  src={order.listing_photo}
                  alt={order.listing_name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs text-white/30">
                No&nbsp;photo
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {order.listing_name}
              </p>
              <p className="text-xs text-white/50">Qty {order.quantity}</p>
              <p className="mt-1 text-lg font-bold text-green-300">
                ${order.total_amount.toFixed(2)}
              </p>
              {/* Customer-side extras breakdown — shows the add-ons
                  they paid for so the receipt is honest about the
                  total. Hidden when no extras. */}
              <OrderExtrasList items={order.items} density="comfortable" />
            </div>
          </div>

          {/* Fulfillment detail. Pickup address is HIDDEN until the creator
              marks the order ready — keeps the creator's home address
              private during the prep window and turns "Ready" into a
              meaningful state change for the customer. */}
          <div className="mt-4 flex items-start gap-2 border-t border-white/[0.06] pt-3 text-xs text-white/60">
            {order.fulfillment_type === "pickup" ? (
              <>
                <MapPin
                  size={14}
                  className="mt-0.5 flex-shrink-0 text-white/40"
                />
                <div>
                  <p className="font-medium text-white/80">Pickup</p>
                  {(order.status === "ready" || order.status === "completed") &&
                  order.pickup_address ? (
                    <>
                      <p className="mt-0.5">{order.pickup_address}</p>
                      <PickupDistance address={order.pickup_address} />
                    </>
                  ) : (
                    <p className="mt-0.5 text-white/40">
                      Pickup details will appear here once your order is
                      ready.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Truck
                  size={14}
                  className="mt-0.5 flex-shrink-0 text-white/40"
                />
                <div className="flex-1">
                  <p className="font-medium text-white/80">Delivery</p>
                  <p className="mt-0.5">
                    {order.delivery_address ?? "Address on file"}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Uber Direct live tracking — surfaces once the
              post-payment webhook has booked the delivery.
              Status pill auto-updates as the order's
              `uber_status` column flips via the inbound webhook
              handler. While the URL is missing (briefly, between
              payment success and the createDelivery call) we
              show a neutral "booking your courier" hint instead
              of nothing. */}
          {order.fulfillment_type === "delivery" &&
            (order.uber_tracking_url ? (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-900/[0.18] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                    Live tracking
                  </p>
                  {order.uber_status && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
                      {formatUberStatus(order.uber_status)}
                    </span>
                  )}
                </div>
                <a
                  href={order.uber_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex h-10 w-full items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-[0_0_14px_rgba(16,185,129,0.4)] active:scale-95 transition-transform"
                >
                  Track your delivery →
                </a>
              </div>
            ) : order.uber_booking_error ? (
              // Booking failed (migration 022). Show a real error state
              // instead of an indefinite spinner so the customer knows the
              // courier didn't dispatch and can reach out. Payment already
              // succeeded — the creator + KDER ops are on the hook to
              // resolve, so we frame it as "we're on it," not a dead end.
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-900/[0.18] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Courier booking delayed
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                  We hit a snag dispatching your courier. Your payment went
                  through and {order.creator_display_name ?? "the creator"} has
                  been notified — message them below and our team will get your
                  delivery sorted.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-900/[0.18] p-3">
                <p className="text-xs text-emerald-200/80">
                  Booking your courier… your tracking link will
                  appear here in a moment.
                </p>
              </div>
            ))}
        </div>

        {/* Message thread — only renders when we have the auth user's id and
            the creator's member_id (otherwise OrderMessages would INSERT with
            invalid ids and fail RLS). */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
            Message {order.creator_display_name ?? "creator"}
          </p>
          {currentUser && order.creator_member_id ? (
            <OrderMessages
              orderId={order.id}
              currentUserId={currentUser.id}
              recipientId={order.creator_member_id}
            />
          ) : (
            <div className="glass-card p-6 text-center text-xs text-white/40">
              Loading messages…
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="pt-2">
          <Link
            href={handle ? `/@${handle}` : "/"}
            className="glass-btn-pill flex h-11 w-full items-center justify-center text-sm font-bold text-white active:scale-95 transition-all"
          >
            {handle ? `Back to @${handle}` : "Back to KDER"}
          </Link>
        </div>
      </div>

      {/* First-time tip on the status timeline. Anchored to the tracker
          so the customer sees how their order moves through stages and
          knows they'll get SMS updates + can message the creator. */}
      <Coachmark
        id="customer-order-status"
        copy={COACHMARK_COPY["customer-order-status"]}
        targetRef={statusTrackerRef}
        showDelayMs={400}
      />
    </main>
  );
}

// ── Status tracker component ────────────────────────────────────────────

type StatusMeta = {
  label: string;
  detail: string;
  tone: "pending" | "green" | "muted" | "red";
  icon: typeof Clock;
};

function statusMeta(order: OrderResponse): StatusMeta {
  switch (order.status) {
    case "pending":
      return {
        label: "Waiting for creator to accept",
        detail: "They'll confirm shortly.",
        tone: "pending",
        icon: Clock,
      };
    case "accepted":
      return {
        label: "Accepted — being prepared",
        detail:
          order.fulfillment_type === "pickup"
            ? "We'll text you when it's ready."
            : "We'll text you when it's on the way.",
        tone: "green",
        icon: CheckCircle2,
      };
    case "ready":
      return {
        label: "Ready!",
        detail:
          order.fulfillment_type === "pickup"
            ? order.pickup_address
              ? `Pickup at: ${order.pickup_address}`
              : "Pickup address will be provided by the creator."
            : "Out for delivery.",
        tone: "green",
        icon: CheckCircle2,
      };
    case "completed":
      return {
        label: "Order complete",
        detail: "Thanks for supporting a local creator.",
        tone: "muted",
        icon: CheckCircle2,
      };
    case "declined":
      return {
        label: "Creator declined",
        detail: "You'll be refunded. Check Stripe for details.",
        tone: "red",
        icon: XCircle,
      };
    case "cancelled":
      return {
        label: "Order cancelled",
        detail: "Your refund has been processed.",
        tone: "red",
        icon: XCircle,
      };
    default:
      return {
        label: "Loading status",
        detail: "",
        tone: "muted",
        icon: Clock,
      };
  }
}

function StatusTracker({ order }: { order: OrderResponse }) {
  const meta = useMemo(() => statusMeta(order), [order]);
  const Icon = meta.icon;

  const toneClasses = {
    pending:
      "border-orange-400/30 bg-orange-900/15 text-orange-300",
    green: "border-green-400/30 bg-green-900/15 text-green-300",
    muted: "border-white/[0.08] bg-white/[0.04] text-white/60",
    red: "border-red-400/30 bg-red-900/20 text-red-300",
  }[meta.tone];

  // 4-step indicator: pending → accepted → ready → completed
  // Declined/cancelled → all dots muted + red current marker
  const steps: { key: OrderStatus; label: string }[] = [
    { key: "pending", label: "Placed" },
    { key: "accepted", label: "Accepted" },
    { key: "ready", label: "Ready" },
    { key: "completed", label: "Done" },
  ];

  const currentIndex = (() => {
    if (order.status === "declined" || order.status === "cancelled") return -1;
    return steps.findIndex((s) => s.key === order.status);
  })();

  return (
    <div className={cn("rounded-2xl border p-4", toneClasses)}>
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold">{meta.label}</p>
          {meta.detail && (
            <p className="mt-0.5 text-xs opacity-80">{meta.detail}</p>
          )}
        </div>
      </div>

      {order.status !== "declined" && order.status !== "cancelled" && (
        <div className="mt-4 flex items-center gap-2">
          {steps.map((step, i) => {
            const reached = i <= currentIndex;
            return (
              <div key={step.key} className="flex-1">
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    reached ? "bg-green-400/80" : "bg-white/10"
                  )}
                />
                <p
                  className={cn(
                    "mt-1 text-[10px] uppercase tracking-wide",
                    reached ? "text-white/70" : "text-white/30"
                  )}
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
          <p className="text-sm text-white/50">Loading…</p>
        </main>
      }
    >
      <OrderConfirmationInner />
    </Suspense>
  );
}

/** Human-friendly label for an Uber Direct status enum value.
 *  The seven raw values are courier-side terminology that
 *  doesn't read well to a customer — translate before showing. */
function formatUberStatus(
  status: NonNullable<OrderResponse["uber_status"]>
): string {
  switch (status) {
    case "pending":
      return "Booking";
    case "pickup":
      return "Courier on the way";
    case "pickup_complete":
      return "Food picked up";
    case "dropoff":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "canceled":
      return "Canceled";
    case "returned":
      return "Returned";
  }
}
