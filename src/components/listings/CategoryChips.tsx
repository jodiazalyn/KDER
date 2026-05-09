"use client";

import { cn } from "@/lib/utils";

interface CategoryChipsProps {
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
}

export function CategoryChips({
  options,
  selected,
  onChange,
  label,
}: CategoryChipsProps) {
  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <div role="group" aria-label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "glass-btn-pill px-4 py-2 text-sm font-medium",
                isSelected
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                  : "text-white/60 hover:text-white/80"
              )}
              aria-pressed={isSelected}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
