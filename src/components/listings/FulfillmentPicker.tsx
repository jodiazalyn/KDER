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
      className="glass-segment flex p-1"
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
            "glass-segment-item flex-1 py-2.5 text-sm font-medium",
            value === opt.value
              ? "glass-segment-item-active border-emerald-400/30 bg-emerald-500/15 text-white"
              : "text-white/50 hover:text-white/70"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
