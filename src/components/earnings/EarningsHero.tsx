"use client";

import { Wallet, Zap } from "lucide-react";

interface EarningsHeroProps {
  balance: number;
  onStandardPayout: () => void;
  onInstantPayout: () => void;
}

export function EarningsHero({
  balance,
  onStandardPayout,
  onInstantPayout,
}: EarningsHeroProps) {
  const hasBalance = balance > 0;

  return (
    <div className="rounded-3xl border border-green-400/[0.25] bg-green-900/[0.40] p-6 backdrop-blur-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-green-300/60" />
        <span className="text-xs font-medium text-green-300/60 uppercase tracking-wider">
          Available Balance
        </span>
      </div>

      <p
        className="mt-2 text-4xl font-bold text-green-300"
        style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }}
      >
        ${balance.toFixed(2)}
      </p>

      {hasBalance && (
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onStandardPayout}
            aria-label="Request standard payout, free, 2 to 3 business days"
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-full border border-white/25 bg-white/[0.08] text-white hover:bg-white/[0.12] active:scale-95 transition-all"
          >
            <span className="text-sm font-bold">Standard</span>
            <span className="text-[10px] text-white/40">Free · 2-3 days</span>
          </button>

          <button
            type="button"
            onClick={onInstantPayout}
            aria-label="Request instant payout, 1 percent fee, within 30 minutes"
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-full bg-white/[0.15] text-white hover:bg-white/[0.2] active:scale-95 transition-all"
          >
            <span className="flex items-center gap-1 text-sm font-bold">
              <Zap size={12} />
              Instant
            </span>
            <span className="text-[10px] text-white/40">1% fee · 30 min</span>
          </button>
        </div>
      )}
    </div>
  );
}
