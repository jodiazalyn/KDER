"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { EarningsHero } from "@/components/earnings/EarningsHero";
import { TransactionRow } from "@/components/earnings/TransactionRow";
import {
  getEarnings,
  type EarningsSummary,
  type Transaction,
} from "@/lib/earnings-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PeriodTab = "week" | "month" | "all";

const TABS: { key: PeriodTab; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [period, setPeriod] = useState<PeriodTab>("week");
  const [showInstantSheet, setShowInstantSheet] = useState(false);

  const load = useCallback(() => {
    setEarnings(getEarnings());
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  if (!earnings) return null;

  const periodAmount =
    period === "week"
      ? earnings.thisWeek
      : period === "month"
        ? earnings.thisMonth
        : earnings.allTime;

  const instantFee = +(earnings.availableBalance * 0.01).toFixed(2);
  const instantPayout = +(earnings.availableBalance - instantFee).toFixed(2);

  const handleStandardPayout = () => {
    if (earnings.availableBalance <= 0) {
      toast.error("No balance available for payout.");
      return;
    }
    toast.success(
      "Standard payout requested! Funds arrive in 2-3 business days."
    );
  };

  const handleInstantConfirm = () => {
    setShowInstantSheet(false);
    toast.success(
      `Instant payout of $${instantPayout.toFixed(2)} initiated! Arrives within 30 minutes.`
    );
  };

  return (
    <main className="px-4 pb-4 pt-6">
      <h1 className="text-3xl font-black text-white">Earnings</h1>

      <div className="mt-4 space-y-4">
        {/* KYC Banner — not dismissible per UX Spec */}
        <div className="rounded-2xl border border-orange-400/20 bg-orange-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 flex-shrink-0 text-orange-400"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-300">
                Complete your payout setup to receive earnings
              </p>
              <p className="mt-1 text-xs text-white/40">
                Set up Stripe Connect to start receiving payouts from your
                orders.
              </p>
              <button
                type="button"
                onClick={() =>
                  toast.info("Stripe Connect setup — coming soon")
                }
                className="mt-2 rounded-full bg-orange-600/30 px-4 py-1.5 text-xs font-bold text-orange-200 active:scale-95 transition-transform"
              >
                Set Up Payouts
              </button>
            </div>
          </div>
        </div>

        {/* Earnings Hero */}
        <EarningsHero
          balance={earnings.availableBalance}
          onStandardPayout={handleStandardPayout}
          onInstantPayout={() => {
            if (earnings.availableBalance <= 0) {
              toast.error("No balance available for payout.");
              return;
            }
            setShowInstantSheet(true);
          }}
        />

        {/* Period Tabs */}
        <div>
          <div className="flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-medium transition-all",
                  period === tab.key
                    ? "bg-white/[0.12] text-white"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Period total */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-white/50">
              {period === "week"
                ? "This week"
                : period === "month"
                  ? "This month"
                  : "All time"}{" "}
              earnings
            </span>
            <span className="text-lg font-bold text-green-300">
              ${periodAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Transaction list */}
        <div>
          <h2
            className="mb-3 text-lg font-bold text-green-300"
            style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
          >
            Transactions
          </h2>

          {earnings.transactions.length > 0 ? (
            <div className="space-y-2">
              {earnings.transactions.map((tx: Transaction) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 pt-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
                <DollarSign size={28} className="text-white/20" />
              </div>
              <p className="text-center text-sm text-white/50">
                No earnings yet. Complete your first order to see your
                balance here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instant Payout Confirmation Sheet */}
      <Sheet open={showInstantSheet} onOpenChange={setShowInstantSheet}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
        >
          <SheetHeader>
            <SheetTitle className="text-white">Instant Payout</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-6">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Available balance</span>
                <span className="text-white">
                  ${earnings.availableBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Instant fee (1%)</span>
                <span className="text-red-400">
                  -${instantFee.toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-white/[0.08]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  You&apos;ll receive
                </span>
                <span
                  className="text-xl font-bold text-green-300"
                  style={{
                    filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
                  }}
                >
                  ${instantPayout.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-white/40 text-center">
              Funds arrive within 30 minutes to your linked bank account.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowInstantSheet(false)}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInstantConfirm}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
              >
                Confirm Payout
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
