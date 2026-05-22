"use client";

import type { EarningsLifetime } from "@/lib/earnings-types";

interface LifetimeStatsCardProps {
  lifetime: EarningsLifetime | null;
  errorCode?: string;
}

const Tile = ({
  label,
  cents,
  accent = "text-white",
}: {
  label: string;
  cents: number;
  accent?: string;
}) => (
  <div className="glass-card rounded-glass-lg flex-1 p-3">
    <p className="text-[10px] text-white/40 uppercase tracking-wider">
      {label}
    </p>
    <p className={`mt-1 text-base font-bold ${accent}`}>
      ${(cents / 100).toFixed(2)}
    </p>
  </div>
);

export function LifetimeStatsCard({
  lifetime,
  errorCode,
}: LifetimeStatsCardProps) {
  if (errorCode) {
    return (
      <div className="glass-card rounded-glass-lg border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
        Stats unavailable [{errorCode}]
      </div>
    );
  }

  const data = lifetime ?? {
    grossSoldCents: 0,
    paidOutCents: 0,
    netPendingCents: 0,
  };

  return (
    <div className="flex gap-2">
      <Tile label="Gross sold" cents={data.grossSoldCents} />
      <Tile
        label="Paid out"
        cents={data.paidOutCents}
        accent="text-green-300"
      />
      <Tile
        label="Net pending"
        cents={data.netPendingCents}
        accent="text-orange-300"
      />
    </div>
  );
}
