"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { OrderCard } from "@/components/orders/OrderCard";
import {
  getOrdersByStatus,
  updateOrderStatus,
  getOrders,
} from "@/lib/orders-store";
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

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [declineId, setDeclineId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setOrders(getOrdersByStatus(activeTab));
    const all = getOrders();
    setCounts({
      active: all.filter((o) =>
        ["pending", "accepted", "ready"].includes(o.status)
      ).length,
      completed: all.filter((o) => o.status === "completed").length,
      declined: all.filter((o) => o.status === "declined").length,
    });
  }, [activeTab]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  // Refresh every 10s for countdown updates
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAccept = (id: string) => {
    updateOrderStatus(id, "accepted");
    toast.success("Order accepted!");
    refresh();
  };

  const handleDecline = (id: string) => {
    setDeclineId(id);
  };

  const confirmDecline = () => {
    if (!declineId) return;
    updateOrderStatus(declineId, "declined");
    toast.success("Order declined. Member will be refunded.");
    setDeclineId(null);
    refresh();
  };

  const handleMarkReady = (id: string) => {
    updateOrderStatus(id, "ready");
    toast.success("Marked as ready! Member has been notified.");
    refresh();
  };

  const handleMarkComplete = (id: string) => {
    updateOrderStatus(id, "completed");
    toast.success("Order complete! Payout triggered.");
    refresh();
  };

  const handle = typeof window !== "undefined"
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
      {orders.length > 0 ? (
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
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
