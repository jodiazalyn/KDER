"use client";

import { useState } from "react";
import { AlertCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import type { EarningsPayout } from "@/lib/earnings-types";

interface FailedPayoutBannerProps {
  payouts: EarningsPayout[];
}

const SESSION_DISMISS_PREFIX = "kder_failed_payout_dismissed_";

/**
 * Surfaces a red banner when the most-recent payout has status='failed'.
 *
 * Why "most recent" rather than "any failed":
 *   - A creator who already saw + acted on an old failure shouldn't
 *     keep getting the alarm. A newer paid payout means Stripe has
 *     moved on; we move on too.
 *
 * Dismiss behaviour:
 *   - sessionStorage keyed by the failed payout's stripe_payout_id.
 *   - Dismissed for this session only — a hard reload re-shows it
 *     until a successful payout supersedes the failed one.
 *   - When a NEW failed payout arrives (different id), banner re-fires
 *     because we key the inner component on payout.id.
 */
export function FailedPayoutBanner({ payouts }: FailedPayoutBannerProps) {
  const latest = payouts[0];
  if (!latest || latest.status !== "failed") {
    return null;
  }
  // Re-mount on payout id change so dismissed state resets cleanly.
  return <Inner key={latest.id} payout={latest} />;
}

function Inner({ payout }: { payout: EarningsPayout }) {
  // Initial dismissed state read from sessionStorage on mount only.
  // Subsequent updates happen only via the click handler.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.sessionStorage.getItem(SESSION_DISMISS_PREFIX + payout.id) ===
        "1"
      );
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(
        SESSION_DISMISS_PREFIX + payout.id,
        "1"
      );
    } catch {
      // sessionStorage unavailable (e.g. private browsing); just hide locally
    }
    setDismissed(true);
  };

  const handleManageInStripe = async () => {
    try {
      const res = await fetch("/api/v1/creators/connect/login-link", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.data?.url) {
        const code = json?.code ? ` [${json.code}]` : "";
        toast.error(`${json?.error ?? "Couldn't open Stripe"}${code}`);
        return;
      }
      window.open(json.data.url, "_blank", "noopener");
    } catch {
      toast.error("Couldn't reach Stripe.");
    }
  };

  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-900/25 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle
          size={18}
          className="mt-0.5 flex-shrink-0 text-red-400"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-red-300">
              Your last payout failed
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="-mt-1 -mr-1 rounded-full p-1 text-red-300/60 hover:bg-red-900/40 hover:text-red-200"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-1 text-xs text-white/60">
            ${(payout.amountCents / 100).toFixed(2)} payout on{" "}
            {new Date(payout.createdAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}{" "}
            didn&apos;t arrive.
          </p>
          {payout.failureReason && (
            <p className="mt-1 text-xs text-white/40">
              Reason: {payout.failureReason}
            </p>
          )}
          <button
            type="button"
            onClick={handleManageInStripe}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-600/30 px-4 py-1.5 text-xs font-bold text-red-200 active:scale-95 transition-transform"
          >
            Fix in Stripe
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
