"use client";

import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";

export interface ActiveOrderSummary {
  id: string;
  status: "pending" | "accepted" | "ready";
  creatorHandle: string;
}

const STATUS_COPY: Record<ActiveOrderSummary["status"], string> = {
  pending: "Awaiting confirmation",
  accepted: "Accepted — being prepared",
  ready: "Ready for pickup",
};

/**
 * Surfaces the visitor's most recent in-flight order with this creator
 * at the top of the storefront so they can hop back to the order page
 * without using browser back. Without this, after checkout success a
 * customer browsing the storefront has no inbound link to their own
 * order details + chat.
 *
 * Renders only when there's an active order. Anonymous visitors with
 * no session see nothing.
 */
export function ActiveOrderBanner({ order }: { order: ActiveOrderSummary }) {
  const shortId = order.id.slice(0, 8);
  const orderUrl = `/order-confirmation?order_id=${order.id}&handle=${encodeURIComponent(order.creatorHandle)}`;

  return (
    <Link
      href={orderUrl}
      className="glass-card flex items-center gap-3 border-primary/30 bg-primary/10 px-4 py-3 active:scale-[0.99] transition-transform"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Receipt size={16} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Your order is live
        </p>
        <p className="text-xs text-muted-foreground truncate">
          #{shortId} · {STATUS_COPY[order.status]}
        </p>
      </div>
      <span className="flex items-center gap-1 text-xs font-bold text-primary">
        View
        <ArrowRight size={12} />
      </span>
    </Link>
  );
}
