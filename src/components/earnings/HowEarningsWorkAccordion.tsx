"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

/**
 * Collapsed-by-default explainer at the bottom of the Earn page.
 * One-time read for new creators — answers "why didn't I get the
 * full $X?" with a worked $20 example.
 *
 * Numbers reflect Stripe's published rates as of 2026:
 *   Card processing: 2.9% + $0.30 (US standard, varies by market)
 *   KDER platform fee: 10% (PLATFORM_FEE_PERCENT)
 */
export function HowEarningsWorkAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left active:bg-white/[0.06] transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <Info size={18} className="text-white/60" />
          <p className="text-sm font-medium text-white">
            How earnings work
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-xs text-white/60 leading-relaxed">
            Every order on KDER goes through Stripe. Here&apos;s what
            happens to a $20 plate:
          </p>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-1.5 text-xs">
            <Row
              label="Order total"
              value="+$20.00"
              accent="text-white"
            />
            <Row
              label="KDER platform fee (10%)"
              value="−$2.00"
              accent="text-red-400"
            />
            <Row
              label="Stripe processing (~2.9% + $0.30)"
              value="−$0.88"
              accent="text-red-400"
            />
            <div className="h-px bg-white/[0.06] my-1" />
            <Row
              label="You receive"
              value="$17.12"
              accent="text-green-300 font-bold"
            />
          </div>

          <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
            Stripe&apos;s exact processing fee can vary slightly by card
            type and country. Refunds reverse both the order total and
            KDER&apos;s fee — Stripe&apos;s processing fee is not refunded.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className={accent}>{value}</span>
    </div>
  );
}
