"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingExtra } from "@/types";

/**
 * Editor for a plate's optional add-ons (extras). Each row is
 * `{ name, price_cents }` where price_cents may be 0 (free extras
 * like "extra spice" are valid — they're customer-visible options,
 * just unpriced).
 *
 * Uses local draft strings per row for the inputs so name + price
 * typing doesn't jump — same pattern that fixed the catering quote
 * builder's line-item typing bug. Whole-dollar prices only
 * (matches every other money input in the creator surface).
 *
 * Hidden in the parent form when kind = "catering" — catering
 * listings use fee_items on quotes for the same role.
 */
interface Props {
  value: ListingExtra[];
  onChange: (next: ListingExtra[]) => void;
}

const NAME_MAX = 60;
const NEW_UID_PREFIX = "x_"; // local React key only, never persisted

function newUid(): string {
  return NEW_UID_PREFIX + Math.random().toString(36).slice(2, 10);
}

interface RowState extends ListingExtra {
  /** Local-only key so React doesn't conflate two rows sharing a
   *  name during edit. */
  uid: string;
}

/** Seed a stable uid per existing entry so list reorders / removes
 *  don't lose focus on adjacent rows. */
function seedRows(extras: ListingExtra[]): RowState[] {
  return extras.map((e) => ({ ...e, uid: newUid() }));
}

export function PlateExtrasEditor({ value, onChange }: Props) {
  // Local row state with uids; commits to the parent's plain
  // ListingExtra[] via onChange.
  const [rows, setRows] = useState<RowState[]>(() => seedRows(value));

  const commit = (next: RowState[]) => {
    setRows(next);
    onChange(next.map(({ name, price_cents }) => ({ name, price_cents })));
  };

  const addRow = () =>
    commit([
      ...rows,
      { uid: newUid(), name: "", price_cents: 0 },
    ]);

  const updateRow = (uid: string, patch: Partial<ListingExtra>) =>
    commit(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const removeRow = (uid: string) =>
    commit(rows.filter((r) => r.uid !== uid));

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/[0.12] px-3 py-4 text-center text-xs text-white/40">
          No extras yet. Add things like drinks, desserts, or extra
          sauce that customers can stack onto this plate.
        </p>
      ) : (
        rows.map((r) => (
          <ExtraRow
            key={r.uid}
            row={r}
            onUpdate={(patch) => updateRow(r.uid, patch)}
            onRemove={() => removeRow(r.uid)}
          />
        ))
      )}
      <button
        type="button"
        onClick={addRow}
        className="mt-1 flex h-11 w-full items-center justify-center gap-1 rounded-full border border-dashed border-white/[0.15] text-sm font-medium text-white/60 transition-colors hover:border-white/[0.30] hover:text-white/80 active:scale-95"
      >
        <Plus size={16} />
        Add an extra
      </button>
    </div>
  );
}

/** One row with local draft strings so typing in name + price
 *  stays smooth. Name commits on every change; price commits as
 *  integer dollars (×100 into cents). */
function ExtraRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: RowState;
  onUpdate: (patch: Partial<ListingExtra>) => void;
  onRemove: () => void;
}) {
  const [nameDraft, setNameDraft] = useState<string>(row.name);
  const [priceDraft, setPriceDraft] = useState<string>(
    row.price_cents > 0 ? String(Math.round(row.price_cents / 100)) : ""
  );

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => {
            const v = e.target.value.slice(0, NAME_MAX);
            setNameDraft(v);
            onUpdate({ name: v });
          }}
          placeholder="e.g. Lemonade, Cookie, Extra spice"
          className="glass-input h-11 flex-1 px-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
        />
        <div className="relative w-24 shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={priceDraft}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setPriceDraft(digits);
              onUpdate({
                price_cents: digits ? parseInt(digits, 10) * 100 : 0,
              });
            }}
            placeholder="0"
            className={cn(
              "glass-input h-11 w-full px-2 pl-6 text-right text-base font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            )}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.name || "extra"}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-300 active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
      {row.price_cents === 0 && nameDraft.trim() && (
        <p className="mt-1.5 text-[11px] text-white/45">
          Free extra — customers will see &ldquo;Included&rdquo; instead of a price.
        </p>
      )}
    </div>
  );
}
