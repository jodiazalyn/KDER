"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingOptionGroup, ListingOptionChoice } from "@/types";

/**
 * Editor for a plate's REQUIRED option groups (migration 023) —
 * "choose exactly one" sets like "Protein: 2 Beef Patties vs 2 Black
 * Bean Patties". Distinct from `PlateExtrasEditor`, which edits the
 * OPTIONAL multi-select add-ons (drinks, toppings). Both surfaces can
 * be present on the same plate.
 *
 * Shape emitted via onChange (matches ListingOptionGroup):
 *   [{ id, title, required:true, min:1, max:1, options:[{name, price_cents}] }]
 *
 * The server re-derives required/min/max and drops groups with fewer
 * than 2 options, so this editor only has to keep the creator's
 * typing smooth — same local-draft-string pattern used by
 * PlateExtrasEditor to avoid input jumpiness.
 *
 * Hidden by the parent form when kind = "catering".
 */
interface Props {
  value: ListingOptionGroup[];
  onChange: (next: ListingOptionGroup[]) => void;
}

const TITLE_MAX = 60;
const NAME_MAX = 60;
const UID_PREFIX = "g_"; // group id prefix; persisted (client-generated)
const ROW_UID_PREFIX = "o_"; // option row react key; local-only

function newGroupId(): string {
  return UID_PREFIX + Math.random().toString(36).slice(2, 10);
}
function newRowUid(): string {
  return ROW_UID_PREFIX + Math.random().toString(36).slice(2, 10);
}

/** Local editor row for an option — carries a uid so React keeps
 *  focus stable across sibling edits/removes (names can collide
 *  mid-type). */
interface OptionRowState extends ListingOptionChoice {
  uid: string;
}
/** Local editor state for a group. */
interface GroupState {
  id: string;
  title: string;
  options: OptionRowState[];
}

function seedGroups(groups: ListingOptionGroup[]): GroupState[] {
  return groups.map((g) => ({
    id: g.id || newGroupId(),
    title: g.title,
    options: (g.options ?? []).map((o) => ({ ...o, uid: newRowUid() })),
  }));
}

/** Project local editor state back into the persisted
 *  ListingOptionGroup shape. required/min/max are fixed for v1 —
 *  the server enforces the same, so this is purely for the live
 *  preview/payload. */
function toGroups(state: GroupState[]): ListingOptionGroup[] {
  return state.map((g) => ({
    id: g.id,
    title: g.title,
    required: true,
    min: 1,
    max: 1,
    options: g.options.map(({ name, price_cents }) => ({ name, price_cents })),
  }));
}

export function OptionGroupsEditor({ value, onChange }: Props) {
  const [groups, setGroups] = useState<GroupState[]>(() => seedGroups(value));

  const commit = (next: GroupState[]) => {
    setGroups(next);
    onChange(toGroups(next));
  };

  const addGroup = () =>
    commit([
      ...groups,
      {
        id: newGroupId(),
        title: "",
        // Seed two blank options — "choose one" needs at least two
        // to be a real choice, so start the creator there.
        options: [
          { uid: newRowUid(), name: "", price_cents: 0 },
          { uid: newRowUid(), name: "", price_cents: 0 },
        ],
      },
    ]);

  const updateGroup = (id: string, patch: Partial<GroupState>) =>
    commit(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const removeGroup = (id: string) =>
    commit(groups.filter((g) => g.id !== id));

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No required choices yet. Add a group like &ldquo;Protein&rdquo;
          or &ldquo;Bread&rdquo; where the customer must pick exactly one
          option before they can order.
        </p>
      ) : (
        groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            onUpdate={(patch) => updateGroup(g.id, patch)}
            onRemove={() => removeGroup(g.id)}
          />
        ))
      )}
      <button
        type="button"
        onClick={addGroup}
        className="mt-1 flex h-11 w-full items-center justify-center gap-1 rounded-full border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground active:scale-95"
      >
        <Plus size={16} />
        Add a required choice
      </button>
    </div>
  );
}

/** One group card: a title input, its option rows, and an add-option
 *  button. Local draft string for the title keeps typing smooth. */
function GroupCard({
  group,
  onUpdate,
  onRemove,
}: {
  group: GroupState;
  onUpdate: (patch: Partial<GroupState>) => void;
  onRemove: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState<string>(group.title);

  const addOption = () =>
    onUpdate({
      options: [
        ...group.options,
        { uid: newRowUid(), name: "", price_cents: 0 },
      ],
    });

  const updateOption = (uid: string, patch: Partial<ListingOptionChoice>) =>
    onUpdate({
      options: group.options.map((o) =>
        o.uid === uid ? { ...o, ...patch } : o
      ),
    });

  const removeOption = (uid: string) =>
    onUpdate({ options: group.options.filter((o) => o.uid !== uid) });

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-3">
      {/* Group header: title + remove-group */}
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => {
            const v = e.target.value.slice(0, TITLE_MAX);
            setTitleDraft(v);
            onUpdate({ title: v });
          }}
          placeholder="Choice name — e.g. Protein, Bread, Spice level"
          className="glass-input h-11 flex-1 px-3 text-base font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${group.title || "choice group"}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500 active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Required · customer picks exactly one. Add at least two options.
        Leave a price at $0 for &ldquo;Included,&rdquo; or set an upcharge.
      </p>

      {/* Option rows */}
      <div className="space-y-2">
        {group.options.map((o) => (
          <OptionRow
            key={o.uid}
            row={o}
            onUpdate={(patch) => updateOption(o.uid, patch)}
            onRemove={() => removeOption(o.uid)}
            canRemove={group.options.length > 2}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
      >
        <Plus size={14} />
        Add an option
      </button>
    </div>
  );
}

/** One option inside a group — name + optional upcharge. Local draft
 *  strings so typing stays smooth (mirrors PlateExtrasEditor's row). */
function OptionRow({
  row,
  onUpdate,
  onRemove,
  canRemove,
}: {
  row: OptionRowState;
  onUpdate: (patch: Partial<ListingOptionChoice>) => void;
  onRemove: () => void;
  /** A "choose one" needs ≥2 options — disable removal at the floor
   *  so the creator can't accidentally make a degenerate group the
   *  server would silently drop. */
  canRemove: boolean;
}) {
  const [nameDraft, setNameDraft] = useState<string>(row.name);
  const [priceDraft, setPriceDraft] = useState<string>(
    row.price_cents > 0 ? String(Math.round(row.price_cents / 100)) : ""
  );

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={nameDraft}
        onChange={(e) => {
          const v = e.target.value.slice(0, NAME_MAX);
          setNameDraft(v);
          onUpdate({ name: v });
        }}
        placeholder="e.g. 2 Beef Patties"
        className="glass-input h-11 flex-1 px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
      />
      <div className="relative w-20 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={priceDraft}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setPriceDraft(digits);
            onUpdate({ price_cents: digits ? parseInt(digits, 10) * 100 : 0 });
          }}
          placeholder="0"
          className={cn(
            "glass-input h-11 w-full px-2 pl-5 text-right text-base font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          )}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove ${row.name || "option"}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <X size={16} />
      </button>
    </div>
  );
}
