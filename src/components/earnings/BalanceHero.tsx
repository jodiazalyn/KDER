"use client";

import { useRef } from "react";
import { Wallet, Zap, Calendar } from "lucide-react";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";
import type {
  EarningsAccountInfo,
  EarningsBalance,
} from "@/lib/earnings-types";
import { StandardPayoutButton } from "./StandardPayoutButton";

interface BalanceHeroProps {
  balance: EarningsBalance | null;
  account: EarningsAccountInfo | null;
  errorCode?: string;
  onInstantPayout: () => void;
  onPayoutSuccess: () => void;
}

function formatNextPayout(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function BalanceHero({
  balance,
  account,
  errorCode,
  onInstantPayout,
  onPayoutSuccess,
}: BalanceHeroProps) {
  const availableCents = balance?.availableCents ?? 0;
  const pendingCents = balance?.pendingCents ?? 0;
  const hasBalance = availableCents > 0;

  // Standard on-demand button only renders when schedule is Manual —
  // otherwise Stripe's auto-schedule sweeps the balance and on-demand
  // taps are confusing.
  const showStandardButton = account?.schedule.interval === "manual";

  // Instant button always enabled when balance > 0. Pre-flight ineligible
  // states (no debit card, instant not enabled by Stripe) are surfaced
  // by the InstantPayoutSheet's explainer views — letting the user tap
  // and learn why is friendlier than a disabled button with a tooltip
  // they may not even discover.

  // Coachmark anchors to the hero on first visit. Only meaningful for
  // creators who have an account loaded (skip the spotlight on empty
  // states / not-yet-onboarded views).
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={heroRef}
      className="rounded-3xl border border-green-400/[0.25] bg-green-900/[0.40] p-6 backdrop-blur-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]"
    >
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
        ${(availableCents / 100).toFixed(2)}
      </p>

      {pendingCents > 0 && (
        <p className="mt-1 text-xs text-white/50">
          + ${(pendingCents / 100).toFixed(2)} pending
        </p>
      )}

      <p className="mt-2 text-[11px] text-white/50">
        KDER&apos;s 10% platform fee is deducted before payout.
      </p>

      {errorCode && (
        <p className="mt-2 text-xs text-red-300">
          Couldn&apos;t reach Stripe. Refresh to retry. [{errorCode}]
        </p>
      )}

      {account?.nextPayoutDate && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
          <Calendar size={12} />
          <span>
            Next payout: {formatNextPayout(account.nextPayoutDate)} · ~$
            {((availableCents + pendingCents) / 100).toFixed(2)}
          </span>
        </div>
      )}

      {hasBalance && (
        <div className="mt-5 flex gap-3">
          {showStandardButton && (
            <StandardPayoutButton
              availableCents={availableCents}
              onSuccess={onPayoutSuccess}
            />
          )}

          <button
            type="button"
            onClick={onInstantPayout}
            aria-label="Request instant payout, 1.5 percent fee, within 30 minutes"
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-full bg-white/[0.15] text-white hover:bg-white/[0.2] active:scale-95 transition-all"
          >
            <span className="flex items-center gap-1 text-sm font-bold">
              <Zap size={12} />
              Instant
            </span>
            <span className="text-[10px] text-white/40">
              1.5% fee · 30 min
            </span>
          </button>
        </div>
      )}

      {/* First-time-user tip pointing at the balance hero. Only fires
          for creators who have a real account context (account != null),
          not first-touch onboarding before they've set anything up. */}
      {account && (
        <Coachmark
          id="creator-earn-balance"
          copy={COACHMARK_COPY["creator-earn-balance"]}
          targetRef={heroRef}
          showDelayMs={300}
        />
      )}
    </div>
  );
}
