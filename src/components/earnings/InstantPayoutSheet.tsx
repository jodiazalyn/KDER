"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface InstantPayoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Available balance the creator can pull. Cents. */
  availableCents: number;
  /** Called after a successful payout so the parent can refresh. */
  onSuccess: () => void;
}

const INSTANT_FEE_PERCENT = 0.015; // Stripe US instant payout fee.

export function InstantPayoutSheet({
  open,
  onOpenChange,
  availableCents,
  onSuccess,
}: InstantPayoutSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  // Mint a fresh idempotency key whenever the sheet opens. A double-tap
  // on Confirm reuses it; a fresh open after dismiss gets a new one.
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    if (open) {
      setIdempotencyKey(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `kder_${Date.now()}_${Math.random().toString(36).slice(2)}`
      );
    }
  }, [open]);

  const { feeCents, payoutCents } = useMemo(() => {
    const fee = Math.round(availableCents * INSTANT_FEE_PERCENT);
    return { feeCents: fee, payoutCents: availableCents - fee };
  }, [availableCents]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/payments/payouts/instant", {
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
        toast.error(`${json?.error ?? "Instant payout failed"}${code}`);
        setSubmitting(false);
        return;
      }
      onOpenChange(false);
      toast.success(
        `Instant payout of $${(payoutCents / 100).toFixed(2)} initiated. Funds arrive within 30 minutes.`
      );
      onSuccess();
    } catch (err) {
      console.error("[InstantPayoutSheet] network error:", err);
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Instant Payout</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Available balance</span>
              <span className="text-white">
                ${(availableCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Instant fee (1.5%)</span>
              <span className="text-red-400">
                −${(feeCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="h-px bg-white/[0.08]" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                You&apos;ll receive
              </span>
              <span
                className="text-xl font-bold text-green-300"
                style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }}
              >
                ${(payoutCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-xs text-white/40 text-center">
            Funds arrive within 30 minutes to your linked debit card. Fee may
            vary by region or balance.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform disabled:opacity-60"
            >
              {submitting ? "Confirming…" : "Confirm Payout"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
