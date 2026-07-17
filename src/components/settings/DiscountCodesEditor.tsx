"use client";

import { Plus, Trash2, Tag } from "lucide-react";
import type { DiscountCode } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Creator-facing editor for storefront promo codes (migration 024).
 * Lives in the Settings page as its own card. Codes are storefront-
 * wide (the cart is per-creator), so they belong here rather than on
 * an individual plate.
 *
 * The parent owns the array and dirty-tracking; this component is a
 * controlled list. Values are kept in the persisted shape:
 *   - `value` is a percentage (1–100) for type "percentage", or CENTS
 *     for type "fixed".
 *   - `min_order` is CENTS or null.
 * The dollar-facing inputs convert to/from cents at the edge so the
 * creator types "5.00" while we store 500.
 */
export function DiscountCodesEditor({
  codes,
  onChange,
}: {
  codes: DiscountCode[];
  onChange: (next: DiscountCode[]) => void;
}) {
  const update = (i: number, patch: Partial<DiscountCode>) => {
    onChange(codes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const remove = (i: number) => onChange(codes.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...codes,
      { code: "", type: "percentage", value: 10, min_order: null, expires_at: null },
    ]);

  return (
    <section className="glass-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Promo codes
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Create codes customers enter at checkout. They apply across your
          whole storefront.
        </p>
      </div>

      {codes.length > 0 ? (
        <div className="space-y-3">
          {codes.map((c, i) => (
            <CodeRow
              key={i}
              code={c}
              onPatch={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No promo codes yet.</p>
      )}

      <button
        type="button"
        onClick={add}
        className="glass-btn-pill flex h-11 w-full items-center justify-center gap-2 text-sm font-medium text-foreground active:scale-95 transition-transform"
      >
        <Plus size={16} />
        Add a promo code
      </button>
    </section>
  );
}

function CodeRow({
  code,
  onPatch,
  onRemove,
}: {
  code: DiscountCode;
  onPatch: (patch: Partial<DiscountCode>) => void;
  onRemove: () => void;
}) {
  const isPct = code.type === "percentage";

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-3 space-y-3">
      {/* Code + delete */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground/60">
            <Tag size={14} />
          </span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={code.code}
            onChange={(e) =>
              // Mirror the server sanitizer: uppercase A–Z0–9, max 20.
              onPatch({
                code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
              })
            }
            placeholder="SUMMER10"
            className="glass-input h-11 w-full rounded-xl pl-9 pr-3 text-sm font-semibold tracking-wide text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 active:scale-90 transition-all"
          aria-label={`Remove ${code.code || "promo code"}`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Type toggle + value */}
      <div className="flex gap-2">
        <div className="glass-segment flex gap-1 p-1">
          <button
            type="button"
            onClick={() =>
              // Switching type reframes `value`: keep a sensible default
              // rather than reinterpreting a percentage as cents.
              onPatch({ type: "percentage", value: isPct ? code.value : 10 })
            }
            className={cn(
              "glass-segment-item px-4 py-2 text-sm font-medium transition-all active:scale-95",
              isPct ? "!bg-primary/15 text-primary !border-primary/30 border" : "text-muted-foreground"
            )}
          >
            % off
          </button>
          <button
            type="button"
            onClick={() => onPatch({ type: "fixed", value: isPct ? 500 : code.value })}
            className={cn(
              "glass-segment-item px-4 py-2 text-sm font-medium transition-all active:scale-95",
              !isPct ? "!bg-primary/15 text-primary !border-primary/30 border" : "text-muted-foreground"
            )}
          >
            $ off
          </button>
        </div>

        <div className="relative flex-1">
          {!isPct && (
            <span className="absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground/70">
              $
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={isPct ? String(code.value) : centsToInput(code.value)}
            onChange={(e) =>
              onPatch({ value: isPct ? clampPct(e.target.value) : inputToCents(e.target.value) })
            }
            placeholder={isPct ? "10" : "5.00"}
            className={cn(
              "glass-input h-11 w-full rounded-xl pr-9 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isPct ? "pl-3" : "pl-7"
            )}
          />
          {isPct && (
            <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground/70">
              %
            </span>
          )}
        </div>
      </div>

      {/* Min order + expiry */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Min order (optional)
          </span>
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground/70">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={code.min_order != null ? centsToInput(code.min_order) : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onPatch({ min_order: v === "" ? null : inputToCents(v) });
              }}
              placeholder="0.00"
              className="glass-input h-11 w-full rounded-xl pl-7 pr-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Expires (optional)
          </span>
          <input
            type="date"
            value={code.expires_at ? code.expires_at.slice(0, 10) : ""}
            onChange={(e) => onPatch({ expires_at: e.target.value || null })}
            className="glass-input h-11 w-full rounded-xl px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      </div>

      {/* Plain-English preview so the creator can sanity-check the rule. */}
      <p className="text-[11px] text-muted-foreground">{describe(code)}</p>
    </div>
  );
}

/** "10% off orders over $25, expires Aug 1, 2026." */
function describe(c: DiscountCode): string {
  if (!c.code) return "Enter a code above to activate this promo.";
  const amount = c.type === "percentage" ? `${c.value}% off` : `$${centsToInput(c.value)} off`;
  const min = c.min_order != null && c.min_order > 0 ? ` orders over $${centsToInput(c.min_order)}` : " every order";
  let exp = "";
  if (c.expires_at) {
    const d = new Date(c.expires_at);
    if (!Number.isNaN(d.getTime())) {
      exp = `, expires ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
  }
  return `${amount}${min}${exp}.`;
}

function clampPct(raw: string): number {
  const n = Math.floor(Number(raw.replace(/[^0-9]/g, "")) || 0);
  return Math.min(100, Math.max(0, n));
}

/** Dollars-string → integer cents. "5" → 500, "5.5" → 550, "5.55" → 555. */
function inputToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dollars = Number(cleaned) || 0;
  return Math.max(0, Math.round(dollars * 100));
}

/** Integer cents → dollars string for display. 500 → "5.00". */
function centsToInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}
