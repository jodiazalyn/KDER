"use client";

import Link from "next/link";
import Image from "next/image";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import type { Order } from "@/types";
import { cn } from "@/lib/utils";

interface RecentOrdersProps {
  handle: string;
  orders: Order[];
}

const STATUS_BADGE: Record<
  Order["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-orange-900/50 text-orange-300" },
  accepted: { label: "Accepted", className: "bg-green-900/50 text-green-300" },
  ready: { label: "Ready", className: "bg-blue-900/50 text-blue-300" },
  completed: { label: "Completed", className: "bg-white/10 text-white/60" },
  declined: { label: "Declined", className: "bg-red-900/40 text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-white/10 text-white/40" },
};

export function RecentOrders({ handle, orders }: RecentOrdersProps) {
  if (orders.length === 0) {
    return (
      <div>
        <h2
          className="mb-3 text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
        >
          Recent Orders
        </h2>
        <div className="glass-card rounded-glass-lg flex flex-col items-center p-6">
          <p className="text-sm text-white/50 text-center">
            No pending orders. Share your link to get your first order.
          </p>
          <div className="mt-3">
            <CopyLinkButton handle={handle} variant="compact" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
        >
          Recent Orders
        </h2>
        <Link
          href="/orders"
          className="text-xs font-medium text-green-400 hover:text-green-300"
        >
          View All
        </Link>
      </div>
      <ul className="space-y-2">
        {orders.map((order) => {
          const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="glass-card rounded-glass-lg flex items-center gap-3 p-3 active:scale-[0.98] transition-transform"
              >
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/[0.1]">
                  {order.member_photo ? (
                    <Image
                      src={order.member_photo}
                      alt={order.member_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/40">
                      {order.member_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {order.member_name}
                    </p>
                    <span className="text-sm font-bold text-green-300 flex-shrink-0">
                      ${order.total_amount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 truncate">
                    {order.listing_name} × {order.quantity}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
