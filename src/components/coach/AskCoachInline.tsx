"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePricingCoach } from "./PricingCoachProvider";

interface Props {
  /** The prompt to pre-fill the agent's input with when opened.
   *  Should read naturally, e.g.
   *    "Help me price my jerk chicken plates — 1 protein + 2 sides".
   *  The user can edit before sending. */
  seedPrompt: string;
  /** Override the default label "Ask Mia". */
  label?: string;
  /** Optional supporting line shown beneath the label — e.g.
   *  "Get a fair price recommendation in 30s". */
  hint?: string;
  /** Visual style — "card" is the boxed CTA suitable for forms, "link"
   *  is a plain inline button suitable for sentence-flow. */
  variant?: "card" | "link";
  className?: string;
}

/**
 * Inline trigger for the Pricing Coach. Drop this anywhere in the
 * authed app where a creator might want help pricing or costing.
 * Tapping opens the global pricing-coach sheet, pre-filled with the
 * provided prompt.
 *
 * Usage:
 *   <AskCoachInline
 *     seedPrompt="Help me price my brisket plates"
 *     hint="Get a market-aware price in 30 seconds"
 *   />
 *
 * The card variant is the default — it's a small bordered surface
 * with the KDER green accent. Use `variant="link"` when the trigger
 * sits inside a sentence ("Not sure? Ask the coach.").
 */
export function AskCoachInline({
  seedPrompt,
  label = "Ask Mia",
  hint,
  variant = "card",
  className,
}: Props) {
  const { open } = usePricingCoach();

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={() => open(seedPrompt)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground underline-offset-4 hover:underline active:scale-95",
          className
        )}
      >
        <Sparkles size={12} className="text-amber-500" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open(seedPrompt)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-green-500/[0.25] bg-gradient-to-br from-green-500/[0.10] to-emerald-500/[0.04] p-3 text-left transition-all hover:border-green-400/40 hover:from-green-500/[0.16] active:scale-[0.99]",
        className
      )}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B5E20] shadow-[0_0_12px_rgba(27,94,32,0.5)]"
      >
        <Sparkles size={16} className="text-amber-200" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-foreground">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground opacity-70 group-hover:opacity-100">
        Open
      </span>
    </button>
  );
}
