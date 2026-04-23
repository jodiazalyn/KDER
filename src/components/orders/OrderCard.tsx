"use client";

import Link from "next/link";
import Image from "next/image";
import { CountdownTimer } from "./CountdownTimer";
import type { Order } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-orange-900/50 text-orange-300" },
  accepted: { label: "Accepted", className: "bg-green-900/50 text-green-300" },
  ready: { label: "Ready", className: "bg-blue-900/50 text-blue-300" },
  completed: { label: "Completed", className: "bg-white/10 text-white/60" },
  declined: { label: "Declined", className: "bg-red-900/40 text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-white/10 text-white/40" },
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
        "rounded-2xl border bg-white/[0.10] backdrop-blur-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]",
        isPending
          ? "border-2 border-orange-400/60"
          : "border-white/[0.18]"
      )}
    >
      <Link
        href={`/orders/${order.id}`}
        className="flex items-start gap-3 p-4"
      >
        {/* Member avatar */}
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/[0.1]">
          {order.member_photo ? (
            <Image
              src={order.member_photo}
              alt={order.member_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-bold text-white/40">
              {order.member_name.charAt(0)}
            </div>
          )}
        </div>

        {/* Order info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white truncate">
              {order.member_name}
            </h3>
            <span
              className="text-2xl font-black text-green-300"
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
            >
              ${order.total_amount.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-white/50 truncate">
            {order.listing_name} × {order.quantity}
          </p>

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
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
              {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
            </span>

            {/* Countdown for pending */}
            {isPending && (
              <CountdownTimer autoDeclineAt={order.auto_decline_at} />
            )}
          </div>
        </div>
      </Link>

      {/* Action buttons */}
      {(isPending || isAccepted || isReady) && (
        <div className="flex gap-2 border-t border-white/[0.08] px-4 py-3">
          {isPending && (
            <>
              {/* Accept is the primary revenue action — wider + taller + glow.
                  Larger flex basis so it dominates the action row. */}
              <button
                type="button"
                onClick={() => onAccept?.(order.id)}
                className="flex h-12 flex-[2] items-center justify-center rounded-full bg-[#1B5E20] text-base font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.55)] active:scale-95 transition-transform"
              >
                Accept · ${order.total_amount.toFixed(2)}
              </button>
              {/* Review replaces Decline — opens the order detail page where
                  the creator can review customer details and, if they want,
                  decline from there via the confirmed decline flow. */}
              <Link
                href={`/orders/${order.id}`}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-sm font-semibold text-white/80 active:scale-95 transition-transform hover:bg-white/[0.08]"
              >
                Review
              </Link>
            </>
          )}
          {isAccepted && (
            <button
              type="button"
              onClick={() => onMarkReady?.(order.id)}
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_16px_rgba(27,94,32,0.4)] active:scale-95 transition-transform"
            >
              Mark Ready
            </button>
          )}
          {isReady && (
            <button
              type="button"
              onClick={() => onMarkComplete?.(order.id)}
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_16px_rgba(27,94,32,0.4)] active:scale-95 transition-transform"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
