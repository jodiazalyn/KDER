"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-white active:scale-90 transition-all",
          value <= min && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Decrease quantity"
      >
        <Minus size={18} />
      </button>

      <span className="w-12 text-center text-xl font-bold text-white">
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-white active:scale-90 transition-all",
          value >= max && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Increase quantity"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
