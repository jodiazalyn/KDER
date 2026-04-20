"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { OrderCard } from "@/components/orders/OrderCard";
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

type TabKey = "active" | "completed" | "declined";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
];

const ACTIVE_STATUSES = new Set<Order["status"]>(["pending", "accepted", "ready"]);

/**
 * Transition an order via one of the lifecycle API routes. Each endpoint is
 * PUT (matching the existing route signatures) and returns a 2xx on success.
 * The caller is expected to refetch the list after a successful call.
 */
async function transitionOrder(
  orderId: string,
  action: "accept" | "decline" | "ready" | "complete"
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

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineId, setDeclineId] = useState<string | null>(null);

  /**
   * We fetch ALL the creator's orders (capped at 100 server-side) in one
   * request and partition client-side by tab. This gives us accurate tab
   * counts without a second request. If volume ever exceeds 100, we'll need
   * per-tab fetches + a separate counts endpoint.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/orders");
      if (!res.ok) {
        setAllOrders([]);
        return;
      }
      const json = await res.json();
      const orders: Order[] = Array.isArray(json?.data?.orders)
        ? json.data.orders
        : [];
      setAllOrders(orders);
    } catch {
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Defer the initial refresh outside the synchronous effect body so the
  // setState inside doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  // Light polling for countdown timers + newly-arrived orders. 15s is enough
  // that a creator actively fulfilling won't miss an order for long, while
  // being gentle on the function quota. Realtime subscription is a follow-up.
  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Sort: pending first (most urgent), then by auto_decline_at ascending to
  // match the old orders-store behavior.
  const activeOrders = allOrders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return (
        new Date(a.auto_decline_at).getTime() -
        new Date(b.auto_decline_at).getTime()
      );
    });
  const completedOrders = allOrders.filter((o) => o.status === "completed");
  const declinedOrders = allOrders.filter((o) => o.status === "declined");

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

  const handleAccept = async (id: string) => {
    const result = await transitionOrder(id, "accept");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Order accepted!");
    refresh();
  };

  const handleDecline = (id: string) => {
    setDeclineId(id);
  };

  const confirmDecline = async () => {
    if (!declineId) return;
    const id = declineId;
    setDeclineId(null);
    const result = await transitionOrder(id, "decline");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Order declined. Member will be refunded.");
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

  const handle =
    typeof window !== "undefined"
      ? sessionStorage.getItem("kder_onboarding_handle") || "mystore"
      : "mystore";

  return (
    <main className="px-4 pb-4 pt-6">
      <h1 className="text-3xl font-black text-white">Orders</h1>

      {/* Tab bar */}
      <div className="mt-4 flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
        {TABS.map((tab) => {
          const count = counts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-white/[0.12] text-white"
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

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        </div>
      ) : visibleOrders.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onMarkReady={handleMarkReady}
              onMarkComplete={handleMarkComplete}
            />
          ))}
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

      {/* Decline confirmation dialog */}
      <Dialog
        open={!!declineId}
        onOpenChange={(open) => {
          if (!open) setDeclineId(null);
        }}
      >
        <DialogContent className="rounded-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Decline this order?</DialogTitle>
            <DialogDescription className="text-white/60">
              The member will receive a full refund. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setDeclineId(null)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={confirmDecline}
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
