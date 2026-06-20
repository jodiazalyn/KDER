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
          "glass-btn-pill flex h-11 w-11 items-center justify-center text-foreground active:scale-90 transition-transform",
          value <= min && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Decrease quantity"
      >
        <Minus size={18} />
      </button>

      <span className="w-12 text-center text-xl font-bold text-foreground">
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          "glass-btn-pill flex h-11 w-11 items-center justify-center text-foreground active:scale-90 transition-transform",
          value >= max && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Increase quantity"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
