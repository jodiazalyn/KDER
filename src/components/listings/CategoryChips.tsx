"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_GROUPS } from "@/types";

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
  const [search, setSearch] = useState("");

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const query = search.trim().toLowerCase();

  // When searching: flat filtered list. When not: grouped layout — OR a
  // flat list if none of the options live in CATEGORY_GROUPS (e.g. the
  // ALLERGENS list passes in 8 tags none of which are in CATEGORY_GROUPS,
  // so without the fallback the grouped branch would render nothing).
  const filtered = useMemo(
    () => options.filter((opt) => opt.toLowerCase().includes(query)),
    [options, query]
  );

  const groups = useMemo(() => {
    if (query) return null;
    return Object.entries(CATEGORY_GROUPS).map(([group, tags]) => ({
      group,
      tags: tags.filter((t) => options.includes(t)),
    }));
  }, [options, query]);

  // True only if at least one option appears in any CATEGORY_GROUPS bucket.
  // When false, we render a flat pill list so the user actually sees their
  // options without having to type into the search box.
  const hasAnyGroupedOption = useMemo(
    () =>
      Object.values(CATEGORY_GROUPS).some((tags) =>
        tags.some((t) => options.includes(t))
      ),
    [options]
  );

  return (
    <div role="group" aria-label={label} className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags…"
          className="glass-input h-10 w-full pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
        />
      </div>

      {query ? (
        /* Flat filtered results */
        filtered.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filtered.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                active={selected.includes(opt)}
                onToggle={() => toggle(opt)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tags match &ldquo;{search}&rdquo;</p>
        )
      ) : hasAnyGroupedOption ? (
        /* Grouped layout — categories that map into CATEGORY_GROUPS */
        <div className="space-y-4">
          {groups?.map(({ group, tags }) =>
            tags.length === 0 ? null : (
              <div key={group}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      active={selected.includes(opt)}
                      onToggle={() => toggle(opt)}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        /* Flat layout — for ungrouped option sets like ALLERGENS */
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              active={selected.includes(opt)}
              onToggle={() => toggle(opt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "glass-btn-pill px-4 py-2 text-sm font-medium transition-all active:scale-95",
        active
          ? "border-emerald-400/30 bg-emerald-500/15 text-accent-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
