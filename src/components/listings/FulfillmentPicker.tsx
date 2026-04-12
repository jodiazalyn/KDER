"use client";

import type { FulfillmentType } from "@/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: FulfillmentType; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
  { value: "both", label: "Both" },
];

interface FulfillmentPickerProps {
  value: FulfillmentType;
  onChange: (value: FulfillmentType) => void;
}

export function FulfillmentPicker({ value, onChange }: FulfillmentPickerProps) {
  return (
    <div
      className="flex rounded-2xl border border-white/[0.12] bg-white/[0.04] p-1"
      role="radiogroup"
      aria-label="Fulfillment type"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all active:scale-95",
            value === opt.value
              ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.4)]"
              : "text-white/50 hover:text-white/70"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
