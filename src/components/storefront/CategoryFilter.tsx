"use client";

import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all",
          selected === null
            ? "bg-green-900/50 text-green-300 border border-green-400/30"
            : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:text-white/70"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(cat === selected ? null : cat)}
          className={cn(
            "flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all",
            selected === cat
              ? "bg-green-900/50 text-green-300 border border-green-400/30"
              : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:text-white/70"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
