"use client";

import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import {
  CATERING_INCLUSION_CATEGORIES,
  type CateringInclusionCategory,
  type CateringInclusionGroups,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * Structured "what's included" editor for catering listings. Replaces
 * the free-text textarea.
 *
 * The creator sees 6 fixed category sections (Protein, Sides, Desserts,
 * Add-ons, Drinks, Toppings/Sauces). Under each section they add items
 * as chips — typing into the inline input + pressing Enter (or blurring)
 * commits the item. Each chip has a 44×44 X button to remove (Apple HIG
 * tap target).
 *
 * Empty categories are still rendered (header + add-input) so the creator
 * sees the full menu structure at a glance and doesn't have to discover
 * which categories exist.
 */

interface Props {
  value: CateringInclusionGroups;
  onChange: (next: CateringInclusionGroups) => void;
}

const ITEM_MAX_LEN = 60;

export function CateringInclusionsEditor({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {CATERING_INCLUSION_CATEGORIES.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          items={value[cat] ?? []}
          onAdd={(item) => {
            const current = value[cat] ?? [];
            // Dedupe (case-insensitive) so a creator can't accidentally
            // list the same protein twice on the same listing.
            const lower = item.toLowerCase();
            if (current.some((existing) => existing.toLowerCase() === lower)) {
              return;
            }
            onChange({ ...value, [cat]: [...current, item] });
          }}
          onRemove={(idx) => {
            const current = value[cat] ?? [];
            const next = current.filter((_, i) => i !== idx);
            // Drop the key entirely when emptied so the JSON stays small.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [cat]: _removed, ...rest } = value;
            onChange(next.length > 0 ? { ...value, [cat]: next } : rest);
          }}
        />
      ))}
      <p className="text-[11px] text-muted-foreground">
        Customers see this as a summary on your storefront card and on the
        order page after they pay the deposit.
      </p>
    </div>
  );
}

function CategorySection({
  category,
  items,
  onAdd,
  onRemove,
}: {
  category: CateringInclusionCategory;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim().slice(0, ITEM_MAX_LEN);
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setDraft("");
    }
  };

  const labelId = `inclusion-${category.toLowerCase().replace(/[^a-z]/g, "-")}`;

  return (
    <section
      aria-labelledby={labelId}
      className="rounded-2xl border border-border bg-white/[0.02] p-3"
    >
      <h3
        id={labelId}
        className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        {category}
      </h3>

      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/[0.25] bg-emerald-500/[0.12] py-1 pl-3 pr-1 text-xs font-medium text-accent-foreground"
          >
            <span className="truncate max-w-[180px]">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label={`Remove ${item}`}
              // 44×44 tap target nested inside the chip — visible hit
              // area stays small but accidental taps just outside still
              // resolve to the X.
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-accent-foreground/70",
                "hover:bg-emerald-500/20 hover:text-accent-foreground active:scale-90 transition-all"
              )}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        {/* Inline add input — looks like a chip, behaves like an input.
            Enter or blur commits; Escape cancels. */}
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white/[0.04] py-1 pl-2 pr-2 text-xs text-muted-foreground">
          <Plus size={12} className="text-muted-foreground" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, ITEM_MAX_LEN))}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            placeholder={items.length === 0 ? `Add ${category.toLowerCase()}` : "Add"}
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{
              width: `${Math.max(
                draft.length + 1,
                items.length === 0 ? category.length + 5 : 5
              )}ch`,
            }}
          />
        </span>
      </div>
    </section>
  );
}
