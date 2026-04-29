"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { EarningsAccountInfo } from "@/lib/earnings-types";

interface KycBannerProps {
  hasConnectAccount: boolean;
  account: EarningsAccountInfo | null;
  loading: boolean;
  onResume: () => void;
}

export function KycBanner({
  hasConnectAccount,
  account,
  loading,
  onResume,
}: KycBannerProps) {
  // Resolve effective state. If we don't have a Connect account yet,
  // that's `not_started` regardless of what's in `account.kycStatus`.
  const status = !hasConnectAccount
    ? "not_started"
    : account?.kycStatus ?? "not_started";

  if (status === "verified") {
    return (
      <div className="rounded-2xl border border-green-400/30 bg-green-900/15 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={18}
            className="mt-0.5 flex-shrink-0 text-green-400"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-300">
              Connected with Stripe
            </p>
            <p className="mt-1 text-xs text-white/40">
              You&apos;re all set to receive payouts. Stripe sends earnings
              to your bank on a 2-day rolling schedule.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // pending / failed / not_started — all action-required states
  const tone =
    status === "failed"
      ? {
          border: "border-red-400/25",
          bg: "bg-red-900/20",
          icon: "text-red-400",
          title: "text-red-300",
          button: "bg-red-600/30 text-red-200",
          headline: "Stripe verification needs attention",
        }
      : {
          border: "border-orange-400/20",
          bg: "bg-orange-900/20",
          icon: "text-orange-400",
          title: "text-orange-300",
          button: "bg-orange-600/30 text-orange-200",
          headline:
            status === "not_started"
              ? "Complete your payout setup to receive earnings"
              : "Finish your Stripe setup",
        };

  // Decision: count-only depth. Stripe's hosted onboarding tells the
  // creator the exact items.
  const subtitle = (() => {
    if (status === "not_started") {
      return "Set up Stripe Connect to start receiving payouts from your orders.";
    }
    if (status === "failed") {
      return "Stripe couldn't verify your info. Retry setup to fix or update your details.";
    }
    const count = account?.currentlyDueCount ?? 0;
    if (count > 0) {
      return `Stripe needs ${count} more detail${count === 1 ? "" : "s"} before you can accept orders.`;
    }
    return "Stripe needs a few more details to verify your account.";
  })();

  const buttonLabel =
    status === "not_started"
      ? "Set Up Payouts"
      : status === "failed"
        ? "Retry Setup"
        : "Continue Setup";

  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className={`mt-0.5 flex-shrink-0 ${tone.icon}`}
        />
        <div className="flex-1">
          <p className={`text-sm font-medium ${tone.title}`}>
            {tone.headline}
          </p>
          <p className="mt-1 text-xs text-white/40">{subtitle}</p>
          <button
            type="button"
            onClick={onResume}
            disabled={loading}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full ${tone.button} px-4 py-1.5 text-xs font-bold active:scale-95 transition-transform disabled:opacity-60`}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
