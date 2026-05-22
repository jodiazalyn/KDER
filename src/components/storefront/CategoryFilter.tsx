"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_GROUPS } from "@/types";

interface CategoryFilterProps {
  availableTags: string[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
}

const GROUPS = Object.keys(CATEGORY_GROUPS);

export function CategoryFilter({ availableTags, selected, onSelect }: CategoryFilterProps) {
  const [activeGroup, setActiveGroup] = useState<string | null>(() => {
    if (!selected) return null;
    return GROUPS.find((g) => CATEGORY_GROUPS[g].includes(selected)) ?? null;
  });

  const groupTags = useMemo(
    () =>
      activeGroup
        ? CATEGORY_GROUPS[activeGroup].filter((t) => availableTags.includes(t))
        : [],
    [activeGroup, availableTags]
  );

  const handleGroupClick = (group: string | null) => {
    setActiveGroup(group);
    if (group === null) {
      onSelect(null);
    } else if (selected && !CATEGORY_GROUPS[group].includes(selected)) {
      onSelect(null);
    }
  };

  return (
    <div>
      {/* Group row */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Pill
          label="All"
          active={activeGroup === null}
          onClick={() => handleGroupClick(null)}
        />
        {GROUPS.map((group) => {
          const hasAvailable = CATEGORY_GROUPS[group].some((t) =>
            availableTags.includes(t)
          );
          if (!hasAvailable) return null;
          return (
            <Pill
              key={group}
              label={group}
              active={activeGroup === group}
              onClick={() => handleGroupClick(group)}
            />
          );
        })}
      </div>

      {/* Tag row — only visible when a group is expanded */}
      {activeGroup && groupTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {groupTags.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              active={selected === tag}
              onClick={() => onSelect(selected === tag ? null : tag)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-btn-pill flex-shrink-0 px-4 py-2 text-xs font-semibold transition-all active:scale-95",
        active
          ? "bg-green-900/50 text-green-300 border-green-400/30 shadow-[0_0_12px_rgba(27,94,32,0.30)]"
          : "text-white/50 hover:text-white/70"
      )}
    >
      {label}
    </button>
  );
}

function TagPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-btn-pill flex-shrink-0 px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95",
        active
          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
          : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:text-white/70"
      )}
    >
      {label}
    </button>
  );
}
