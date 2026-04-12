"use client";

import Link from "next/link";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

interface RecentOrdersProps {
  handle: string;
}

export function RecentOrders({ handle }: RecentOrdersProps) {
  // Demo mode — no real orders yet
  const orders: unknown[] = [];

  if (orders.length === 0) {
    return (
      <div>
        <h2
          className="mb-3 text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
        >
          Recent Orders
        </h2>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 flex flex-col items-center">
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
    </div>
  );
}
