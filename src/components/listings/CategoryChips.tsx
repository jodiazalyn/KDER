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
                "rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95",
                isSelected
                  ? "bg-green-900/40 border border-green-400/25 text-green-300"
                  : "border border-white/[0.12] bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
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
