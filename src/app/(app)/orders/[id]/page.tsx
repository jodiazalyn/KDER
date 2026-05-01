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
import { OrderMessages } from "@/components/orders/OrderMessages";
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
  pending: { label: "Pending", color: "text-orange-300" },
  accepted: { label: "Accepted", color: "text-green-300" },
  ready: { label: "Ready for Pickup", color: "text-blue-300" },
  completed: { label: "Completed", color: "text-white/60" },
  declined: { label: "Declined", color: "text-red-300" },
  cancelled: { label: "Cancelled", color: "text-white/40" },
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
      accepted: "Order accepted! Member has been notified with your address.",
      ready: "Marked as ready! Member has been notified.",
      completed: "Order complete! Payout triggered.",
      declined: "Order declined. Member will be refunded.",
    };
    toast.success(messages[newStatus] || "Order updated.");
  };

  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
  });

  return (
    <main className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-[#0A0A0A]/90 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Order Detail</h1>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* Order header — total + time + countdown */}
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-3xl font-bold text-green-300"
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
              <span className="text-xs text-white/30">·</span>
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Clock size={10} />
                {timeAgo}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                Auto-decline in
              </span>
              <CountdownTimer
                autoDeclineAt={order.auto_decline_at}
                className="text-lg"
              />
            </div>
          )}
        </div>

        {/* Member profile card */}
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/[0.1]">
              {order.member_photo ? (
                <Image
                  src={order.member_photo}
                  alt={order.member_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/40">
                  {order.member_name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                {order.member_name}
              </p>
              <p className="text-xs text-white/40">Member</p>
            </div>
          </div>
        </div>

        {/* Plate summary */}
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]">
          <div className="flex gap-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/[0.12]">
              {order.listing_photo ? (
                <Image
                  src={order.listing_photo}
                  alt={order.listing_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/[0.04]">
                  <ImageOff size={20} className="text-white/20" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">{order.listing_name}</p>
              <p className="text-sm text-white/50">Qty: {order.quantity}</p>
              {order.notes && (
                <p className="mt-1 text-xs text-white/40 italic">
                  &ldquo;{order.notes}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Fulfillment badge */}
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
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
          className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] text-left active:scale-[0.98] transition-transform"
          aria-expanded={showTransaction}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-green-400" />
              <span className="text-sm font-semibold text-white">
                Transaction Details
              </span>
            </div>
            <ChevronDown
              size={16}
              className={cn(
                "text-white/40 transition-transform duration-200",
                showTransaction && "rotate-180"
              )}
            />
          </div>

          {showTransaction && (
            <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* Line items */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">
                  {order.listing_name} × {order.quantity}
                </span>
                <span className="text-white">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>

              <div className="h-px bg-white/[0.08]" />

              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Subtotal</span>
                <span className="text-white">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>

              {/* Platform fee */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">KDER fee (10%)</span>
                <span className="text-red-400">
                  -${order.platform_fee.toFixed(2)}
                </span>
              </div>

              <div className="h-px bg-white/[0.08]" />

              {/* Your payout */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Your payout</span>
                <span
                  className="text-lg font-bold text-green-300"
                  style={{
                    filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
                  }}
                >
                  ${order.creator_payout.toFixed(2)}
                </span>
              </div>

              {/* Order ID + timestamps */}
              <div className="mt-2 space-y-1 rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Order ID</span>
                  <span className="text-white/50 font-mono text-[10px]">
                    {order.id.slice(0, 20)}...
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Placed</span>
                  <span className="text-white/50">
                    {new Date(order.created_at).toLocaleDateString()} at{" "}
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Terms accepted</span>
                  <span className="text-white/50">
                    {new Date(order.terms_accepted_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Fulfillment</span>
                  <span className="text-white/50 capitalize">
                    {order.fulfillment_type}
                  </span>
                </div>
              </div>
            </div>
          )}
        </button>

        {/* Post-acceptance: address reveal */}
        {(isAccepted || isReady) && (
          <div className="rounded-2xl border border-green-400/20 bg-green-900/20 p-4">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-green-400" />
              <p className="text-sm font-medium text-green-300">
                Pickup address shared with member
              </p>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Your address has been revealed to the member for this order.
            </p>
          </div>
        )}

        {/* Order message thread */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-white/60">
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

      {/* Sticky bottom action bar */}
      {isActive && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 pb-3">
          <div className="mx-auto flex max-w-lg gap-3">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeclineDialog(true)}
                  className="flex h-12 flex-1 items-center justify-center rounded-full border-2 border-red-500/60 text-base font-bold text-white active:scale-95 transition-transform"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("accepted")}
                  className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-base font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
                >
                  Accept Order
                </button>
              </>
            )}
            {isAccepted && (
              <button
                type="button"
                onClick={() => handleAction("ready")}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-base font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
              >
                Mark Ready
              </button>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => handleAction("completed")}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-base font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
              >
                Mark Complete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Decline confirmation dialog */}
      <Dialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
      >
        <DialogContent className="rounded-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Decline this order?
            </DialogTitle>
            <DialogDescription className="text-white/60">
              The member will receive a full refund. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeclineDialog(false)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
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
