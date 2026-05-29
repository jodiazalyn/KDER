"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { OrderCard } from "@/components/orders/OrderCard";
import { CateringInflightCard } from "@/components/catering/CateringInflightCard";
import type { CateringInflight } from "@/lib/loaders/catering-inflight";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";
import type { Order } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabKey = "active" | "completed" | "declined";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
];

const ACTIVE_STATUSES = new Set<Order["status"]>([
  "pending",
  "accepted",
  "ready",
]);

/**
 * Transition an order via one of the lifecycle API routes. Each
 * returns 2xx on success; the caller follows up with
 * router.refresh() to re-fetch the list via the Server Component.
 */
async function transitionOrder(
  orderId: string,
  action: "accept" | "ready" | "complete"
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/v1/orders/${orderId}/${action}`, {
      method: "PUT",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error || `Failed to ${action} order.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: `Failed to ${action} order.` };
  }
}

interface Props {
  initialOrders: Order[];
  /** Resolved server-side from the creator's handle. Used by the
   *  empty-state CTA. Falls back to sessionStorage if absent. */
  handle: string;
  /** In-flight catering work (open inquiries / sent quotes /
   *  pending bookings). Rendered as a rich card above the
   *  plate-orders tabs so creators never lose track of catering
   *  during the quote/negotiation phase. */
  cateringInflight: CateringInflight;
}

/**
 * Orders inbox client island.
 *
 * Owns: tab state, mutation handlers, polling, coachmark anchor,
 * pull-to-refresh gesture. Data is hydrated from the server
 * page (no initial useEffect-fetch waterfall); subsequent
 * mutations + the 15s poll both trigger `router.refresh()`,
 * which re-runs the Server Component loader and re-hydrates
 * `initialOrders` on the next render.
 */
export function OrdersClient({
  initialOrders,
  handle,
  cateringInflight,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("active");

  // Light polling for countdown timers + newly-arrived orders.
  // 15s — enough that an actively-fulfilling creator won't miss
  // an order, gentle on function quota. router.refresh re-runs
  // the Server Component loader (RSC payload only, not a full
  // HTML re-render) so the cost is much smaller than the old
  // useEffect fetch.
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Sort: furthest-down-the-funnel first. A "ready" order means
  // the plate is made and the customer is about to pick up —
  // creator's most urgent next action. "Accepted" orders are
  // being prepared. "Pending" orders are awaiting accept
  // decision. Within each status: oldest first so the longest-
  // waiting customer rises.
  const STATUS_PRIORITY: Record<Order["status"], number> = {
    ready: 0,
    accepted: 1,
    pending: 2,
    completed: 3,
    declined: 4,
    cancelled: 5,
  };
  const activeOrders = initialOrders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .sort((a, b) => {
      const ap = STATUS_PRIORITY[a.status];
      const bp = STATUS_PRIORITY[b.status];
      if (ap !== bp) return ap - bp;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  const completedOrders = initialOrders.filter(
    (o) => o.status === "completed"
  );
  const declinedOrders = initialOrders.filter(
    (o) => o.status === "declined"
  );

  const counts: Record<TabKey, number> = {
    active: activeOrders.length,
    completed: completedOrders.length,
    declined: declinedOrders.length,
  };

  const visibleOrders =
    activeTab === "active"
      ? activeOrders
      : activeTab === "completed"
        ? completedOrders
        : declinedOrders;

  // Coachmark anchor: ID of the first pending order in the
  // active tab. Conditional ref attach during the .map.
  const firstPendingRef = useRef<HTMLDivElement>(null);
  const firstPendingId =
    activeTab === "active"
      ? (activeOrders.find((o) => o.status === "pending")?.id ?? null)
      : null;

  const handleAccept = async (id: string) => {
    const result = await transitionOrder(id, "accept");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Order accepted!");
    refresh();
  };

  const handleMarkReady = async (id: string) => {
    const result = await transitionOrder(id, "ready");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked as ready! Member has been notified.");
    refresh();
  };

  const handleMarkComplete = async (id: string) => {
    const result = await transitionOrder(id, "complete");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Order complete! Payout triggered.");
    refresh();
  };

  return (
    <PullToRefresh onRefresh={async () => refresh()}>
      <main className="px-4 pb-4 pt-6">
        <h1 className="text-3xl font-black text-white">Orders</h1>

        {/* Catering "in-flight" surface — covers the gap between
            an inquiry landing and a booking being confirmed.
            Shows open inquiries (need a quote), sent quotes
            (waiting on deposit), and pending bookings (4hr
            accept clock running). Data flows from the server
            via cateringInflight prop and refreshes on the
            15s router.refresh tick alongside the orders list. */}
        <CateringInflightCard inflight={cateringInflight} />

        <div className="glass-segment mt-4 flex gap-1 p-1">
          {TABS.map((tab) => {
            const count = counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "glass-segment-item flex-1 py-2 text-xs font-medium",
                  activeTab === tab.key
                    ? "glass-segment-item-active text-white"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-1 text-[10px]",
                      tab.key === "active" ? "text-orange-300" : "opacity-60"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {visibleOrders.length > 0 ? (
          <div className="mt-4 space-y-3">
            {visibleOrders.map((order) => {
              const isFirstPending =
                activeTab === "active" &&
                order.status === "pending" &&
                order.id === firstPendingId;
              return (
                <div
                  key={order.id}
                  ref={isFirstPending ? firstPendingRef : undefined}
                >
                  <OrderCard
                    order={order}
                    onAccept={handleAccept}
                    onMarkReady={handleMarkReady}
                    onMarkComplete={handleMarkComplete}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 pt-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <Bell size={28} className="text-white/20" />
            </div>
            {activeTab === "active" && (
              <>
                <p className="text-center text-sm text-white/50">
                  No pending orders. Share your link to get your first order.
                </p>
                <CopyLinkButton handle={handle} variant="compact" />
              </>
            )}
            {activeTab === "completed" && (
              <p className="text-center text-sm text-white/50">
                No completed orders yet. They&apos;ll show up here after your
                first sale.
              </p>
            )}
            {activeTab === "declined" && (
              <p className="text-center text-sm text-white/50">
                No declined orders.
              </p>
            )}
          </div>
        )}

        {firstPendingId && (
          <Coachmark
            id="creator-orders-pending"
            copy={COACHMARK_COPY["creator-orders-pending"]}
            targetRef={firstPendingRef}
            showDelayMs={300}
          />
        )}
      </main>
    </PullToRefresh>
  );
}
