"use client";

import { Zap } from "lucide-react";
import type { EarningsPayout } from "@/lib/earnings-types";

interface PayoutHistoryListProps {
  payouts: EarningsPayout[];
  errorCode?: string;
}

const STATUS_PILL: Record<
  EarningsPayout["status"],
  { label: string; className: string }
> = {
  paid: { label: "Paid", className: "bg-green-900/50 text-green-300" },
  pending: {
    label: "Pending",
    className: "bg-orange-900/40 text-orange-300",
  },
  failed: { label: "Failed", className: "bg-red-900/50 text-red-300" },
};

export function PayoutHistoryList({
  payouts,
  errorCode,
}: PayoutHistoryListProps) {
  if (errorCode) {
    return (
      <div className="glass-card rounded-glass-lg border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
        Couldn&apos;t load payout history. [{errorCode}]
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="glass-card rounded-glass-lg p-6 text-center text-sm text-white/50">
        No payouts yet — earnings auto-pay on your schedule.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {payouts.map((p) => {
        const pill = STATUS_PILL[p.status];
        const date = new Date(p.arrivalDate ?? p.createdAt);
        return (
          <div
            key={p.id}
            className="glass-card rounded-glass-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                  {p.method === "instant" && (
                    <Zap size={12} className="text-white/60" />
                  )}
                  {p.method === "instant" ? "Instant payout" : "Payout"}
                </p>
                <p className="text-xs text-white/40">
                  {date.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {p.feeCents > 0 && (
                    <>
                      {" "}
                      · −${(p.feeCents / 100).toFixed(2)} fee
                    </>
                  )}
                </p>
                {p.status === "failed" && p.failureReason && (
                  <p className="mt-1 text-xs text-red-300/80">
                    {p.failureReason}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className="text-base font-bold text-green-300"
                  style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
                >
                  ${(p.amountCents / 100).toFixed(2)}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pill.className}`}
                >
                  {pill.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
