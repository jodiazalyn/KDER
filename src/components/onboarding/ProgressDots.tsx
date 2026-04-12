"use client";

import { cn } from "@/lib/utils";

interface ProgressDotsProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressDots({ current, total, className }: ProgressDotsProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isCurrent = step === current;

        return (
          <div
            key={step}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              isCurrent
                ? "w-6 bg-green-400"
                : isCompleted
                  ? "w-2 bg-green-400/60"
                  : "w-2 bg-white/20"
            )}
          />
        );
      })}
    </div>
  );
}
