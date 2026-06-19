"use client";

import Link from "next/link";
import Image from "next/image";
import { CountdownTimer } from "./CountdownTimer";
import { OrderExtrasList } from "./OrderExtrasList";
import type { Order } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:bg-orange-900/50 dark:text-orange-300" },
  accepted: { label: "Accepted", className: "bg-primary/10 text-primary" },
  ready: { label: "Ready", className: "bg-blue-500/10 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
  declined: { label: "Declined", className: "bg-red-500/10 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground/70" },
};

interface OrderCardProps {
  order: Order;
  onAccept?: (id: string) => void;
  onMarkReady?: (id: string) => void;
  onMarkComplete?: (id: string) => void;
}

export function OrderCard({
  order,
  onAccept,
  onMarkReady,
  onMarkComplete,
}: OrderCardProps) {
  const badge = STATUS_BADGES[order.status] || STATUS_BADGES.pending;
  const isPending = order.status === "pending";
  const isAccepted = order.status === "accepted";
  const isReady = order.status === "ready";

  return (
    <div
      className={cn(
        // glass-card-elevated for the in-app order card surface.
        // Pending gets a stronger orange border to draw the eye to
        // the action-required state.
        "glass-card-elevated rounded-glass-lg",
        isPending && "border-2 border-orange-400/60"
      )}
    >
      <Link
        href={`/orders/${order.id}`}
        className="flex items-start gap-3 p-4"
      >
        {/* Member avatar */}
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {order.member_photo ? (
            <Image
              src={order.member_photo}
              alt={order.member_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-bold text-muted-foreground">
              {order.member_name.charAt(0)}
            </div>
          )}
        </div>

        {/* Order info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {order.member_name}
            </h3>
            <span
              className="text-2xl font-black text-primary"
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
            >
              ${order.total_amount.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground truncate">
            {order.listing_name} × {order.quantity}
          </p>
          {/* Compact extras sub-list — only renders when the order
              has any. Density="tight" keeps inbox rows scannable. */}
          <OrderExtrasList items={order.items} density="tight" showPrices={false} />


          <div className="mt-1.5 flex items-center gap-2">
            {/* Status badge */}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                badge.className
              )}
            >
              {badge.label}
            </span>

            {/* Fulfillment pill */}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
            </span>

            {/* Elapsed-time pill for pending */}
            {isPending && (
              <CountdownTimer createdAt={order.created_at} />
            )}
          </div>
        </div>
      </Link>

      {/* Action buttons */}
      {(isPending || isAccepted || isReady) && (
        <div className="flex gap-2 border-t border-border px-4 py-3">
          {isPending && (
            <>
              {/* Accept is the primary revenue action — wider + taller + glow.
                  Larger flex basis so it dominates the action row. */}
              <button
                type="button"
                onClick={() => onAccept?.(order.id)}
                className="flex h-12 flex-[2] items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-base font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
              >
                Accept · ${order.total_amount.toFixed(2)}
              </button>
              {/* Review replaces Decline — opens the order detail page where
                  the creator can review customer details and, if they want,
                  decline from there via the confirmed decline flow. */}
              <Link
                href={`/orders/${order.id}`}
                className="glass-btn-secondary flex h-12 flex-1 items-center justify-center rounded-full text-sm font-semibold text-foreground/80 active:scale-95 transition-transform"
              >
                Review
              </Link>
            </>
          )}
          {isAccepted && (
            <button
              type="button"
              onClick={() => onMarkReady?.(order.id)}
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
            >
              Mark Ready
            </button>
          )}
          {isReady && (
            <button
              type="button"
              onClick={() => onMarkComplete?.(order.id)}
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
