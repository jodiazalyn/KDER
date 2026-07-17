"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Clock,
  MapPin,
  ImageOff,
  MessageCircle,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { CountdownTimer } from "@/components/orders/CountdownTimer";
import { OrderExtrasList } from "@/components/orders/OrderExtrasList";
import { OrderMessages } from "@/components/orders/OrderMessages";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Order } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "text-amber-700 dark:text-orange-300" },
  accepted: { label: "Accepted", color: "text-primary" },
  ready: { label: "Ready for Pickup", color: "text-blue-700 dark:text-blue-300" },
  completed: { label: "Completed", color: "text-muted-foreground" },
  declined: { label: "Declined", color: "text-red-600 dark:text-red-400" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground/60" },
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/orders/${id}`);
      if (!res.ok) {
        // 404 means the order doesn't exist OR the caller isn't its creator.
        // Either way, kick back to the list.
        router.replace("/orders");
        return;
      }
      const json = await res.json();
      const found: Order | undefined = json?.data?.order;
      if (!found) {
        router.replace("/orders");
        return;
      }
      setOrder(found);
    } catch {
      router.replace("/orders");
    }
  }, [id, router]);

  // Wrap in requestAnimationFrame to defer setState outside the synchronous
  // effect body. Required by React 19 / Next 15 lint rule
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadOrder();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadOrder]);

  if (!order) return null;

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const isPending = order.status === "pending";
  const isAccepted = order.status === "accepted";
  const isReady = order.status === "ready";
  const isActive = isPending || isAccepted || isReady;

  // Map the target status to the corresponding lifecycle API action slug.
  const STATUS_TO_ACTION: Record<string, string> = {
    accepted: "accept",
    declined: "decline",
    ready: "ready",
    completed: "complete",
  };

  const handleAction = async (newStatus: Order["status"]) => {
    const action = STATUS_TO_ACTION[newStatus];
    if (!action) return;

    try {
      const res = await fetch(`/api/v1/orders/${order.id}/${action}`, {
        method: "PUT",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || `Failed to update order.`);
        return;
      }
    } catch {
      toast.error("Failed to update order.");
      return;
    }

    // Refetch the order so we pick up any server-side changes (updated_at,
    // SMS-side-effect flags, etc.) instead of guessing at the shape locally.
    await loadOrder();

    const messages: Record<string, string> = {
      // Address is intentionally NOT shared on accept — it's revealed to the
      // member only when the order is marked Ready. Toast copy reflects that.
      accepted: "Order accepted! Member has been notified.",
      ready: "Marked as ready! Member can now see your pickup address.",
      completed: "Order complete! Payout triggered.",
      // Manual decline doesn't fire a Stripe refund (the decline route
      // only flips status). Pending orders weren't charged in the first
      // place — the checkout.session.completed webhook would have moved
      // them to 'accepted' if they had been. So no refund to promise.
      declined: "Order declined. Member has been notified.",
    };
    toast.success(messages[newStatus] || "Order updated.");
  };

  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
  });

  return (
    <main className="min-h-[100dvh] bg-background pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* Header — translucent sticky chrome via raw backdrop-filter
          (the plugin's `glass-nav` forces `position: fixed; top: 0`
          which overrides `sticky` and detaches the header from the
          scroll container). Back button is 44px per Apple HIG. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Order Detail</h1>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* Order header — total + time + countdown */}
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-3xl font-bold text-primary"
              style={{
                filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
              }}
            >
              ${order.total_amount.toFixed(2)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("text-sm font-medium", statusConfig.color)}>
                {statusConfig.label}
              </span>
              <span className="text-xs text-muted-foreground/60">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={10} />
                {timeAgo}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                Customer waiting
              </span>
              <CountdownTimer
                createdAt={order.created_at}
                className="text-lg"
              />
            </div>
          )}
        </div>

        {/* Member profile card */}
        <div className="glass-card rounded-glass-lg p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {order.member_photo ? (
                <Image
                  src={order.member_photo}
                  alt={order.member_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                  {order.member_name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {order.member_name}
              </p>
              <p className="text-xs text-muted-foreground">Member</p>
            </div>
          </div>
        </div>

        {/* Plate summary */}
        <div className="glass-card rounded-glass-lg p-4">
          <div className="flex gap-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border">
              {order.listing_photo ? (
                <Image
                  src={order.listing_photo}
                  alt={order.listing_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted/40">
                  <ImageOff size={20} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{order.listing_name}</p>
              <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
              {/* Extras the customer picked at checkout — comfortable
                  density shows name + qty + per-extra subtotal so
                  the creator can pack the order accurately. */}
              <OrderExtrasList items={order.items} density="comfortable" />
              {order.notes && (
                <p className="mt-1 text-xs text-muted-foreground italic">
                  &ldquo;{order.notes}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Fulfillment badge */}
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {order.fulfillment_type === "pickup"
                ? "Pickup"
                : order.fulfillment_type === "delivery"
                  ? "Delivery"
                  : "Pickup & Delivery"}
            </span>
          </div>
        </div>

        {/* Transaction details — tappable card */}
        <button
          type="button"
          onClick={() => setShowTransaction(!showTransaction)}
          className="glass-card rounded-glass-lg w-full p-4 text-left active:scale-[0.98] transition-transform"
          aria-expanded={showTransaction}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Transaction Details
              </span>
            </div>
            <ChevronDown
              size={16}
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                showTransaction && "rotate-180"
              )}
            />
          </div>

          {showTransaction && (
            <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* Line items */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {order.listing_name} × {order.quantity}
                </span>
                <span className="text-foreground">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>

              <div className="h-px bg-border" />

              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>

              {/* Promo code (migration 024). Shown when a discount was
                  applied — total_amount + payout already reflect it; this
                  line just tells the creator which code the customer used
                  and how much came off. */}
              {order.discount_cents != null && order.discount_cents > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Promo{order.discount_code ? ` (${order.discount_code})` : ""}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    -${(order.discount_cents / 100).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Platform fee */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">KDER fee (10%)</span>
                <span className="text-red-600 dark:text-red-400">
                  -${order.platform_fee.toFixed(2)}
                </span>
              </div>

              <div className="h-px bg-border" />

              {/* Your payout */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Your payout</span>
                <span
                  className="text-lg font-bold text-primary"
                  style={{
                    filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
                  }}
                >
                  ${order.creator_payout.toFixed(2)}
                </span>
              </div>

              {/* Order ID + timestamps */}
              <div className="mt-2 space-y-1 rounded-xl bg-muted/40 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60">Order ID</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {order.id.slice(0, 20)}...
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60">Placed</span>
                  <span className="text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()} at{" "}
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60">Terms accepted</span>
                  <span className="text-muted-foreground">
                    {new Date(order.terms_accepted_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60">Fulfillment</span>
                  <span className="text-muted-foreground capitalize">
                    {order.fulfillment_type}
                  </span>
                </div>
              </div>
            </div>
          )}
        </button>

        {/* Post-acceptance: address reveal */}
        {(isAccepted || isReady) && (
          <div className="glass-card rounded-glass-lg border-emerald-400/25 bg-primary/10 p-4">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <p className="text-sm font-medium text-primary">
                Pickup address shared with member
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your address has been revealed to the member for this order.
            </p>
          </div>
        )}

        {/* Order message thread */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageCircle size={14} />
            Order Messages
          </h3>
          {/* currentUserId MUST be auth.uid() (= members.id for the logged-in
              creator), NOT order.creator_id (= creators.id). Supabase RLS on
              the `messages` table requires sender_id = auth.uid() on INSERT,
              so passing creators.id causes every send to fail signature-like
              with "Couldn't send message." While the user loads, we render
              nothing so we never insert with an undefined/wrong id. */}
          {currentUser && (
            <OrderMessages
              orderId={order.id}
              currentUserId={currentUser.id}
              recipientId={order.member_id}
            />
          )}
        </div>
      </div>

      {/* Action bar — Accept/Decline (pending) → Mark Ready (accepted) → Mark Complete (ready). */}
      {isActive && (
        <FloatingActionBar styled={false}>
          <div className="flex gap-3">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeclineDialog(true)}
                  className="flex h-12 flex-1 items-center justify-center rounded-full border-2 border-red-500/60 text-base font-bold text-red-600 dark:text-red-400 active:scale-95 transition-transform"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("accepted")}
                  className="flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-base font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
                >
                  Accept Order
                </button>
              </>
            )}
            {isAccepted && (
              <button
                type="button"
                onClick={() => handleAction("ready")}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-base font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
              >
                Mark Ready
              </button>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => handleAction("completed")}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-base font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
              >
                Mark Complete
              </button>
            )}
          </div>
        </FloatingActionBar>
      )}

      {/* Decline confirmation dialog */}
      <Dialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
      >
        <DialogContent className="text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Decline this order?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The member will receive a full refund. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeclineDialog(false)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold text-foreground active:scale-95 transition-transform"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={() => {
                handleAction("declined");
                setShowDeclineDialog(false);
              }}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              Decline
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
