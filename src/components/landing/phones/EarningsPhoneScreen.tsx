import { ArrowDownToLine, Banknote, Zap } from "lucide-react";
import { PhoneStatusBar } from "./PhoneStatusBar";

/**
 * Earnings preview screen — what a creator sees when they tap the
 * Earn tab. Headlines the available balance + lifetime stat to make
 * the marketing point that "the money is real and visible." The
 * Instant payout button echoes the PayoutShowcase section's
 * "minutes to your debit card" promise.
 *
 * Numbers are intentionally believable-but-aspirational marketing
 * fiction — chosen to feel like "a real working creator" without
 * promising specific income (which would be a regulatory issue).
 * If we ever surface real average-creator earnings stats, this is
 * the place to point them at.
 */

interface Tx {
  label: string;
  detail: string;
  amount: number;
}

const TRANSACTIONS: Tx[] = [
  { label: "Pork Chop Plate", detail: "Maya R · 2h ago", amount: 18 },
  { label: "Oxtail Plate", detail: "DJ K · 5h ago", amount: 22 },
  { label: "Greens & Cornbread", detail: "Tia W · Yesterday", amount: 12 },
  { label: "Catfish & Grits", detail: "Marcus B · Yesterday", amount: 16 },
];

export function EarningsPhoneScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <PhoneStatusBar />

      {/* Top header */}
      <div className="px-4 pb-3 pt-3">
        <h3 className="text-base font-extrabold text-white">Earnings</h3>
      </div>

      {/* Balance hero */}
      <div className="mx-4 mb-3 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-kder-green/20 to-transparent p-4">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">
          Available
        </p>
        <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight text-white">
          $842.50
        </p>
        <p className="mt-2 text-[10px] text-white/60">
          Lifetime: $4,318 &middot; 142 plates
        </p>
      </div>

      {/* Action buttons */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-kder-green py-2.5 text-[10px] font-bold text-white"
        >
          <Zap size={14} strokeWidth={2.5} />
          Instant payout
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/[0.10] bg-white/[0.04] py-2.5 text-[10px] font-bold text-white/85"
        >
          <ArrowDownToLine size={14} strokeWidth={2.5} />
          To bank
        </button>
      </div>

      {/* Pill row */}
      <div className="mb-3 flex gap-1.5 overflow-hidden px-4">
        <span className="rounded-full bg-white/[0.10] px-2.5 py-1 text-[9px] font-semibold text-white">
          Balance
        </span>
        <span className="rounded-full bg-transparent px-2.5 py-1 text-[9px] font-semibold text-white/50">
          Payouts
        </span>
        <span className="rounded-full bg-transparent px-2.5 py-1 text-[9px] font-semibold text-white/50">
          History
        </span>
      </div>

      {/* Transactions */}
      <div className="mx-4 flex-1 overflow-hidden">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/40">
          Recent
        </p>
        <ul className="space-y-1.5">
          {TRANSACTIONS.map((tx, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-kder-green/15 text-kder-green-light">
                <Banknote size={12} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold text-white">
                  {tx.label}
                </p>
                <p className="truncate text-[9px] text-white/45">
                  {tx.detail}
                </p>
              </div>
              <p className="text-[10px] font-bold text-kder-green-light">
                +${tx.amount.toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
