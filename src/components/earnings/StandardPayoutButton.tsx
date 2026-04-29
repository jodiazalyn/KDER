"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface StandardPayoutButtonProps {
  availableCents: number;
  onSuccess: () => void;
}

/**
 * Renders inside BalanceHero ONLY when the creator's payout schedule
 * is Manual — otherwise Stripe's auto-schedule is sweeping the balance
 * and a tap-then-empty error is confusing.
 */
export function StandardPayoutButton({
  availableCents,
  onSuccess,
}: StandardPayoutButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    // New key per mount (i.e. when balance hero remounts after a refresh).
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `kder_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
  }, []);

  const handleClick = async () => {
    if (submitting) return;
    if (availableCents <= 0) {
      toast.error("No balance available for payout.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/payments/payouts/standard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ amount_cents: availableCents }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = json?.code ? ` [${json.code}]` : "";
        toast.error(`${json?.error ?? "Standard payout failed"}${code}`);
        setSubmitting(false);
        return;
      }
      toast.success(
        `Standard payout of $${(availableCents / 100).toFixed(2)} requested. Funds arrive in 2-3 business days.`
      );
      onSuccess();
    } catch (err) {
      console.error("[StandardPayoutButton] network error:", err);
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      aria-label="Request standard payout, free, 2 to 3 business days"
      className="flex h-12 flex-1 flex-col items-center justify-center rounded-full border border-white/25 bg-white/[0.08] text-white hover:bg-white/[0.12] active:scale-95 transition-all disabled:opacity-60"
    >
      <span className="text-sm font-bold">
        {submitting ? "Requesting…" : "Standard"}
      </span>
      <span className="text-[10px] text-white/40">Free · 2-3 days</span>
    </button>
  );
}
