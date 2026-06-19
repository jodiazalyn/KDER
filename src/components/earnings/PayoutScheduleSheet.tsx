"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PayoutScheduleInterval } from "@/lib/earnings-types";

interface PayoutScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentInterval: PayoutScheduleInterval;
  currentWeeklyAnchor: string | null;
  onSuccess: () => void;
}

const ANCHORS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
];

export function PayoutScheduleSheet({
  open,
  onOpenChange,
  currentInterval,
  currentWeeklyAnchor,
  onSuccess,
}: PayoutScheduleSheetProps) {
  const [interval, setInterval] =
    useState<PayoutScheduleInterval>(currentInterval);
  const [anchor, setAnchor] = useState<string>(
    currentWeeklyAnchor ?? "monday"
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/creators/connect/payout-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval,
          weekly_anchor: interval === "weekly" ? anchor : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = json?.code ? ` [${json.code}]` : "";
        toast.error(`${json?.error ?? "Couldn't update schedule"}${code}`);
        setSubmitting(false);
        return;
      }
      onOpenChange(false);
      toast.success("Payout schedule updated.");
      onSuccess();
    } catch (err) {
      console.error("[PayoutScheduleSheet] network error:", err);
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Sheet primitive provides glass-modal substrate from Phase 2.
        className="rounded-t-glass-lg text-foreground"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Payout Schedule</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <div className="space-y-2">
            <ScheduleOption
              label="Daily"
              description="Stripe pays you every business day"
              checked={interval === "daily"}
              onChange={() => setInterval("daily")}
            />
            <ScheduleOption
              label="Weekly"
              description="One payout per week"
              checked={interval === "weekly"}
              onChange={() => setInterval("weekly")}
            />
            {interval === "weekly" && (
              <div className="ml-6 mt-2 flex gap-1.5">
                {ANCHORS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAnchor(a.key)}
                    className={
                      a.key === anchor
                        ? "flex-1 rounded-lg bg-primary/10 px-2 py-2 text-xs font-bold text-primary"
                        : "flex-1 rounded-lg bg-muted px-2 py-2 text-xs text-muted-foreground hover:bg-muted/70"
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <ScheduleOption
              label="Manual"
              description="No auto-payouts; pull on demand"
              checked={interval === "manual"}
              onChange={() => setInterval("manual")}
            />
          </div>

          <p className="text-xs text-muted-foreground/60 text-center">
            Changes take effect on your next payout cycle. Funds already in
            transit are unaffected.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold text-foreground active:scale-95 transition-transform disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScheduleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={
        checked
          ? "glass-card rounded-glass-lg flex w-full items-start gap-3 border-emerald-400/30 bg-emerald-500/10 p-4 text-left"
          : "glass-card rounded-glass-lg flex w-full items-start gap-3 p-4 text-left hover:bg-muted/60"
      }
    >
      <div
        className={
          checked
            ? "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 dark:border-green-400"
            : "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-border"
        }
      >
        {checked && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 dark:bg-green-400" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
