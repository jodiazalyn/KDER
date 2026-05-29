"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  X,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import { TimePicker12h } from "@/components/ui/time-picker-12h";
import { COACHMARK_COPY } from "@/lib/coachmarks";

/**
 * Creator's quote builder. Three columns of state:
 *
 *   1. Line items — what the customer pays for (each item = qty × price)
 *      Starter rows come from inquiry.pre_selected_listing_ids if any
 *      were pinned; creator can add custom items or pull from menu.
 *
 *   2. Fees — delivery / labor / server / setup. Doesn't count toward
 *      the 30% deposit basis (per the spec: deposit is on food only).
 *
 *   3. Tax + expires_days — small extras
 *
 * Send → POST /api/v1/catering/quotes → email goes to both parties.
 */

interface InquiryRow {
  id: string;
  event_date: string;
  event_time: string | null;
  guest_count: number;
  event_address: string | null;
  /** Customer-picked service mode. Drives which fee categories are
   *  offered below. Null on pre-016 inquiries → fall back to full
   *  service so the creator gets the broadest set of options. */
  service_style: "full_service" | "drop_off" | null;
  needs_server: boolean;
  needs_setup: boolean;
  pre_selected_listing_ids: string[];
  status: string;
  member: { display_name: string; email: string | null } | null;
}

interface MenuListing {
  id: string;
  name: string;
  price: number; // dollars
  photos: string[];
  catering_pricing_mode: "per_head" | "flat" | null;
  catering_min_guests: number | null;
  catering_max_guests: number | null;
}

interface LineItemDraft {
  // Local id for React keying; the API computes total_cents itself.
  uid: string;
  name: string;
  qty: number;
  unit_price_cents: number;
  listing_id: string | null;
}

/** One structured fee row on the quote. The `tag` drives the visible
 *  category pill and the available extras (Server gets a shift-end
 *  time input, everything else is just label + amount). */
type FeeTag = "server" | "delivery" | "setup" | "warming" | "custom";

interface FeeItemDraft {
  uid: string;
  tag: FeeTag;
  /** Human label shown in the breakdown. Defaults to the tag's title
   *  (e.g. "Server") but creators can customize for "Custom" rows. */
  label: string;
  amount_cents: number;
  /** Only meaningful when tag === "server" — when the server's shift
   *  ends. The start time = inquiry.event_time (the customer's
   *  event start). 24-hour "HH:MM". */
  shift_end_time: string | null;
}

interface Props {
  inquiry: InquiryRow;
  menuListings: MenuListing[];
}

const DEPOSIT_PERCENT = 30;

/** Catalog of fee tags + per-mode availability + default copy. The
 *  quote builder filters by `service_style` from the inquiry so the
 *  creator can't accidentally add a "Server" fee to a Drop-Off job
 *  (where there is no staff on site). */
const FEE_CATALOG: Record<
  FeeTag,
  { title: string; suggested: number; description: string }
> = {
  server: {
    title: "Server",
    suggested: 150,
    description: "Staff member on site during the event.",
  },
  delivery: {
    title: "Delivery",
    suggested: 50,
    description: "Bringing the food to the venue.",
  },
  setup: {
    title: "Setup",
    suggested: 75,
    description: "Arranging the buffet / table at the venue.",
  },
  warming: {
    title: "Warming",
    suggested: 60,
    description:
      "Burners + chafing dishes to keep the food warm at the venue. Covers coming back to collect the gear after the event.",
  },
  custom: {
    title: "Custom",
    suggested: 0,
    description: "Anything else — label it however you want.",
  },
};

const FEES_BY_MODE: Record<
  "full_service" | "drop_off",
  readonly FeeTag[]
> = {
  full_service: ["server", "delivery", "setup", "custom"],
  drop_off: ["warming", "delivery", "custom"],
};

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Whole-dollar input → cents. Strips anything non-digit, parses an
 *  integer. The quote builder uses whole dollars across the board
 *  (line items, fees, tax) — partial-cent inputs were causing a
 *  cursor-jumping bug because every keystroke would re-format the
 *  value through `toFixed(2)`. Whole-dollar inputs render exactly
 *  what the user typed, so the cursor stays put. */
function wholeDollarsToCents(v: string | number): number {
  if (typeof v === "number") return Math.max(0, Math.round(v) * 100);
  const digits = v.replace(/\D/g, "");
  if (!digits) return 0;
  return Math.max(0, parseInt(digits, 10) * 100);
}

/** Cents → display string. Drops the .00 when whole. Catering totals
 *  often land on round numbers so this is the common case. */
function money(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function QuoteBuilderClient({ inquiry, menuListings }: Props) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────
  const [items, setItems] = useState<LineItemDraft[]>(() => {
    // Seed from pre-selected items. Pricing mode "per_head" gets
    // qty = guest_count, otherwise qty = 1.
    return inquiry.pre_selected_listing_ids
      .map((id) => menuListings.find((l) => l.id === id))
      .filter((l): l is MenuListing => !!l)
      .map((l) => ({
        uid: newUid(),
        name: l.name,
        qty: l.catering_pricing_mode === "per_head" ? inquiry.guest_count : 1,
        unit_price_cents: wholeDollarsToCents(l.price),
        listing_id: l.id,
      }));
  });

  // Structured fee items — tagged by category. Tags available depend
  // on the inquiry's service_style. The single `fees_cents` number on
  // the API is kept as the sum for back-compat.
  const [feeItems, setFeeItems] = useState<FeeItemDraft[]>([]);
  const [taxCents, setTaxCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [expiresDays, setExpiresDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Which fee tags are offered for this inquiry. Falls back to
  // full_service when the inquiry is pre-016 (no service_style picked)
  // so the creator still sees the broadest options.
  const availableTags = useMemo<readonly FeeTag[]>(
    () => FEES_BY_MODE[inquiry.service_style ?? "full_service"],
    [inquiry.service_style]
  );

  // Auto-seed a Server fee on first load if the customer marked
  // needs_server and the inquiry is full-service. Creator can edit
  // amount or remove it. One-shot — only fires when feeItems is empty.
  useEffect(() => {
    if (feeItems.length > 0) return;
    if (inquiry.needs_server && availableTags.includes("server")) {
      setFeeItems([
        {
          uid: newUid(),
          tag: "server",
          label: FEE_CATALOG.server.title,
          amount_cents: wholeDollarsToCents(FEE_CATALOG.server.suggested),
          shift_end_time: null,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived totals ────────────────────────────────────────
  const foodSubtotalCents = useMemo(
    () => items.reduce((acc, it) => acc + it.qty * it.unit_price_cents, 0),
    [items]
  );
  // Sum of the structured fee items — what the API stores as the
  // single `fees_cents` total for back-compat with downstream code
  // (deposit/balance math, balance-charge cron) that still reads it
  // as a number.
  const feesCents = useMemo(
    () => feeItems.reduce((acc, f) => acc + f.amount_cents, 0),
    [feeItems]
  );
  const totalCents = foodSubtotalCents + feesCents + taxCents;
  const depositCents = Math.round(foodSubtotalCents * (DEPOSIT_PERCENT / 100));
  const balanceCents = totalCents - depositCents;

  // ── Mutators ──────────────────────────────────────────────
  const addBlankItem = () =>
    setItems((prev) => [
      ...prev,
      { uid: newUid(), name: "", qty: 1, unit_price_cents: 0, listing_id: null },
    ]);

  const addFromMenu = (l: MenuListing) => {
    setItems((prev) => [
      ...prev,
      {
        uid: newUid(),
        name: l.name,
        qty: l.catering_pricing_mode === "per_head" ? inquiry.guest_count : 1,
        unit_price_cents: wholeDollarsToCents(l.price),
        listing_id: l.id,
      },
    ]);
    setShowMenu(false);
  };

  const updateItem = (uid: string, patch: Partial<LineItemDraft>) =>
    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it))
    );

  const removeItem = (uid: string) =>
    setItems((prev) => prev.filter((it) => it.uid !== uid));

  // ── Fee mutators ──────────────────────────────────────────
  const addFee = (tag: FeeTag) => {
    const cat = FEE_CATALOG[tag];
    setFeeItems((prev) => [
      ...prev,
      {
        uid: newUid(),
        tag,
        label: cat.title,
        amount_cents: wholeDollarsToCents(cat.suggested),
        shift_end_time: null,
      },
    ]);
  };
  const updateFee = (uid: string, patch: Partial<FeeItemDraft>) =>
    setFeeItems((prev) =>
      prev.map((f) => (f.uid === uid ? { ...f, ...patch } : f))
    );
  const removeFee = (uid: string) =>
    setFeeItems((prev) => prev.filter((f) => f.uid !== uid));

  // ── Send ──────────────────────────────────────────────────
  const canSend =
    items.length > 0 &&
    items.every((it) => it.name.trim() && it.qty > 0 && it.unit_price_cents > 0);

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/v1/catering/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry_id: inquiry.id,
          line_items: items.map((it) => ({
            name: it.name.trim(),
            qty: it.qty,
            unit_price_cents: it.unit_price_cents,
            listing_id: it.listing_id,
          })),
          fees_cents: feesCents,
          // New: structured fee breakdown so the customer sees
          // categorized rows ("Server", "Delivery", "Warming") on
          // the quote review page, not just one collapsed "Fees" line.
          fee_items: feeItems.map((f) => ({
            tag: f.tag,
            label: f.label.trim() || FEE_CATALOG[f.tag].title,
            amount_cents: f.amount_cents,
            shift_end_time:
              f.tag === "server" ? f.shift_end_time || null : null,
          })),
          tax_cents: taxCents,
          creator_notes: notes.trim() || null,
          expires_days: expiresDays,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.data?.quote) {
        toast.error(body?.error || "Couldn't send the quote.");
        return;
      }
      toast.success("Quote sent. The customer will get an email + SMS.");
      router.push(`/catering/inquiries/${inquiry.id}`);
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  };

  const customerName = inquiry.member?.display_name ?? "Customer";
  const eventDateLabel = new Date(
    inquiry.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    // pb-[10rem+safe] reserves room for the stacked footer:
    // BottomNav (5rem) + the sticky send-quote bar (~5rem) +
    // breathing room. Without this the "Customer will see" preview
    // block ends up tucked behind the send bar.
    <div className="flex min-h-[100dvh] flex-col bg-[#0A0A0A] pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-white">
            Build quote
          </h1>
          <p className="truncate text-xs text-white/50">
            {customerName} · {eventDateLabel} · {inquiry.guest_count} guests
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mx-auto max-w-lg space-y-5">
          {/* Line items */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70">
                Line items
              </h2>
              <button
                type="button"
                onClick={() => setShowMenu((o) => !o)}
                className={cn(
                  "flex h-9 items-center gap-1 rounded-full border border-white/[0.10] px-3 text-xs font-medium transition-all active:scale-95",
                  showMenu
                    ? "bg-green-900/40 text-green-300"
                    : "text-white/70 hover:bg-white/[0.06]"
                )}
              >
                <Sparkles size={12} />
                From menu
              </button>
            </div>

            {/* Inline "from menu" picker */}
            {showMenu && (
              <div className="mb-3 space-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
                {menuListings.length === 0 ? (
                  <p className="p-3 text-center text-xs text-white/40">
                    No catering menu items yet. Publish some first.
                  </p>
                ) : (
                  menuListings.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => addFromMenu(l)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04] active:scale-[0.99]"
                    >
                      <span className="truncate text-white/90">{l.name}</span>
                      <span className="shrink-0 text-xs text-white/50">
                        ${l.price.toFixed(0)}
                        {l.catering_pricing_mode === "per_head"
                          ? "/guest"
                          : " flat"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Items list */}
            <ul className="space-y-2">
              {items.length === 0 && (
                <li className="rounded-2xl border border-dashed border-white/[0.12] py-6 text-center text-xs text-white/40">
                  No items yet. Add from menu or a custom line.
                </li>
              )}
              {items.map((it) => (
                <LineItemRow
                  key={it.uid}
                  item={it}
                  onUpdate={(patch) => updateItem(it.uid, patch)}
                  onRemove={() => removeItem(it.uid)}
                />
              ))}
            </ul>

            <button
              type="button"
              onClick={addBlankItem}
              className="mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-full border border-dashed border-white/[0.15] text-sm font-medium text-white/60 transition-colors hover:border-white/[0.30] hover:text-white/80 active:scale-95"
            >
              <Plus size={16} />
              Add custom line item
            </button>
          </section>

          {/* Fees — tagged structured list. Available tags filtered
              by the inquiry's service_style (set by the customer on
              the inquiry form). Server rows get an extra shift-end
              time input; Warming rows show the "no staff on site"
              explanation. */}
          <section>
            <div className="mb-2 flex items-center">
              <h2 className="text-sm font-semibold text-white/70">
                Fees{" "}
                <span className="text-xs font-normal text-white/40">
                  (not in deposit)
                </span>
              </h2>
              <InfoTip label="Why aren't fees in the deposit?">
                {COACHMARK_COPY["creator-catering-quote-fees"]}
              </InfoTip>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
              {/* Existing fee rows */}
              {feeItems.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs text-white/40">
                  No fees yet. Tap a category below to add one.
                </p>
              ) : (
                feeItems.map((f) => (
                  <FeeItemRow
                    key={f.uid}
                    fee={f}
                    eventStartTime={inquiry.event_time}
                    onUpdate={(patch) => updateFee(f.uid, patch)}
                    onRemove={() => removeFee(f.uid)}
                  />
                ))
              )}
              {/* Add-fee chips, filtered by service style. Already-
                  added single-instance tags stay enabled so creators
                  can add multiples if they really need to (one chip
                  per tap, not toggled). */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {availableTags.map((tag) => {
                  const cat = FEE_CATALOG[tag];
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addFee(tag)}
                      className="flex items-center gap-1 rounded-full border border-white/[0.10] px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:border-green-400/40 hover:bg-green-900/20 hover:text-green-200 active:scale-95"
                    >
                      <Plus size={11} />
                      {cat.title}
                      {cat.suggested > 0 && (
                        <span className="text-white/40">
                          · ${cat.suggested}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Mode-specific helper text */}
              {inquiry.service_style === "drop_off" && (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/55">
                  Drop-off: food is freshly prepared and delivered
                  with no staff on site. Add a Warming fee if you&apos;ll
                  bring burners + come back to collect them.
                </p>
              )}
            </div>
          </section>

          {/* Tax — whole-dollar input, matches the line-item pattern. */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-white/70">Tax</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={taxCents === 0 ? "" : String(Math.round(taxCents / 100))}
                onChange={(e) => setTaxCents(wholeDollarsToCents(e.target.value))}
                className="glass-input h-11 w-full px-3 pl-7 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                placeholder="0"
              />
            </div>
          </section>

          {/* Notes */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-white/70">
              Notes for the customer
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Anything they should know about this quote — setup time, what's included, your cancellation terms…"
              rows={3}
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 resize-none"
            />
          </section>

          {/* Expiration */}
          <section>
            <div className="mb-2 flex items-center">
              <h2 className="text-sm font-semibold text-white/70">
                Quote expires in
              </h2>
              <InfoTip label="Which to pick?">
                {COACHMARK_COPY["creator-catering-quote-expiration"]}
              </InfoTip>
            </div>
            <div className="flex gap-2">
              {[3, 7, 14].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiresDays(d)}
                  className={cn(
                    "h-10 flex-1 rounded-full border text-sm transition-all active:scale-95",
                    expiresDays === d
                      ? "border-green-400/40 bg-green-900/40 text-green-300"
                      : "border-white/[0.10] text-white/60 hover:text-white/80"
                  )}
                >
                  {d} days
                </button>
              ))}
            </div>
          </section>

          {/* Totals preview */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Customer will see
            </h2>
            <ul className="space-y-1.5 text-sm">
              <Row label="Food subtotal" value={money(foodSubtotalCents)} />
              {/* Each fee row shows the category label so the
                  customer sees what they're paying for, not just one
                  collapsed "Fees" number. */}
              {feeItems.map((f) => (
                <Row
                  key={f.uid}
                  label={
                    f.tag === "server" && f.shift_end_time
                      ? `${FEE_CATALOG[f.tag].title} · ends ${formatTime12h(f.shift_end_time)}`
                      : f.label || FEE_CATALOG[f.tag].title
                  }
                  value={money(f.amount_cents)}
                />
              ))}
              {taxCents > 0 && <Row label="Tax" value={money(taxCents)} />}
              <li className="my-2 h-px bg-white/[0.06]" />
              <Row label="Total" value={money(totalCents)} bold />
              <Row
                label={`Due now (deposit, ${DEPOSIT_PERCENT}%)`}
                value={money(depositCents)}
                accent
              />
              <Row label="Balance" value={money(balanceCents)} muted />
            </ul>
          </section>
        </div>
      </div>

      {/* Sticky send bar — positioned ABOVE the BottomNav (5rem +
          safe-area) so the "Send quote to {customer}" button isn't
          painted over by the z-50 nav tabs. Without this, creators
          finish the quote and can't find any submit button at the
          bottom of the page. Same fix pattern as
          InquiryActions/BookingActions (commit 87228df). The nav
          handles iOS safe-area below us, so we use a flat py-3
          here (the old `pb-[calc(0.75rem+safe)]` was double-padding). */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-all active:scale-95",
              canSend && !sending
                ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
                : "cursor-not-allowed bg-white/[0.08] text-white/40"
            )}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send size={16} />
                Send quote to {customerName}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "text-sm",
          bold && "font-bold text-white",
          accent && "text-green-300",
          muted && "text-white/50",
          !bold && !accent && !muted && "text-white/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          bold && "text-base font-bold text-white",
          accent && "text-sm font-bold text-green-300",
          muted && "text-sm text-white/60",
          !bold && !accent && !muted && "text-sm text-white/90"
        )}
      >
        {value}
      </span>
    </li>
  );
}

/** One editable line item row with local draft state for the inputs.
 *  Why local state: the previous implementation derived input values
 *  from `unit_price_cents / 100` formatted with .toFixed(2) on every
 *  keystroke, which collapsed the cursor and bounced the value
 *  around mid-typing. This component owns its own draft strings,
 *  letting the user type naturally; we commit the parsed integer on
 *  every change (whole dollars only — no decimal parsing surprises).
 *  Qty supports a temporarily empty value while editing; we clamp to
 *  >= 1 on blur. */
function LineItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: LineItemDraft;
  onUpdate: (patch: Partial<LineItemDraft>) => void;
  onRemove: () => void;
}) {
  // Local draft strings so the user can type freely. Seeded from the
  // committed value on mount; after that, the inputs own the truth.
  // We don't sync from props on every render — the parent updates
  // `item.qty/unit_price_cents` in response to our own onUpdate
  // callback, so the local draft is already authoritative. Adding new
  // items uses a fresh uid (so a fresh LineItemRow mounts with a
  // fresh draft seeded from the new menu values).
  const [nameDraft, setNameDraft] = useState(item.name);
  const [qtyDraft, setQtyDraft] = useState<string>(String(item.qty));
  const [priceDraft, setPriceDraft] = useState<string>(
    item.unit_price_cents > 0
      ? String(Math.round(item.unit_price_cents / 100))
      : ""
  );

  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => {
            const v = e.target.value.slice(0, 200);
            setNameDraft(v);
            onUpdate({ name: v });
          }}
          placeholder="Item name"
          className="glass-input h-11 flex-1 px-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove line item"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-300 active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Qty
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={qtyDraft}
            onChange={(e) => {
              // Allow free typing — only digits, but accept empty
              // string mid-edit so the cursor doesn't snap back.
              const digits = e.target.value.replace(/\D/g, "");
              setQtyDraft(digits);
              const n = parseInt(digits, 10);
              if (!isNaN(n) && n > 0) onUpdate({ qty: n });
            }}
            onBlur={() => {
              // Clamp to >=1 on blur. If the field is empty we snap
              // to 1 so the line item stays valid.
              const n = parseInt(qtyDraft, 10);
              const clamped = !isNaN(n) && n > 0 ? n : 1;
              setQtyDraft(String(clamped));
              onUpdate({ qty: clamped });
            }}
            className="glass-input h-11 w-full px-3 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Unit price
          </span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-white/40">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={priceDraft}
              onChange={(e) => {
                // Whole dollars only — strip everything non-digit so
                // the user can't even type a decimal point. Removes
                // the cursor-jumping bug entirely.
                const digits = e.target.value.replace(/\D/g, "");
                setPriceDraft(digits);
                onUpdate({
                  unit_price_cents: digits ? parseInt(digits, 10) * 100 : 0,
                });
              }}
              placeholder="0"
              className="glass-input h-11 w-full px-3 pl-7 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
          </div>
        </label>
      </div>
      <p className="mt-2 text-right text-xs text-white/50">
        Line total:{" "}
        <span className="font-semibold text-white/80">
          {money(item.qty * item.unit_price_cents)}
        </span>
      </p>
    </li>
  );
}

/** One fee row in the structured Fees section. Renders a category
 *  pill + whole-dollar amount input. Server gets an extra "shift
 *  ends" time input (start time = event start time, surfaced as a
 *  read-only label). */
function FeeItemRow({
  fee,
  eventStartTime,
  onUpdate,
  onRemove,
}: {
  fee: FeeItemDraft;
  eventStartTime: string | null;
  onUpdate: (patch: Partial<FeeItemDraft>) => void;
  onRemove: () => void;
}) {
  const cat = FEE_CATALOG[fee.tag];
  // Local draft for the amount input — same pattern as LineItemRow.
  // Seeded once; the row's uid changes when a new fee is added so we
  // don't need a sync effect when the parent reseeds.
  const [amountDraft, setAmountDraft] = useState<string>(
    fee.amount_cents > 0
      ? String(Math.round(fee.amount_cents / 100))
      : ""
  );

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            fee.tag === "server" && "bg-purple-900/40 text-purple-200",
            fee.tag === "delivery" && "bg-blue-900/40 text-blue-200",
            fee.tag === "setup" && "bg-amber-900/40 text-amber-200",
            fee.tag === "warming" && "bg-orange-900/40 text-orange-200",
            fee.tag === "custom" && "bg-white/[0.10] text-white/70"
          )}
        >
          {cat.title}
        </span>
        {/* Custom rows let the creator name the line themselves;
            tagged rows show the tag name and stay focused on the
            amount field. */}
        {fee.tag === "custom" ? (
          <input
            type="text"
            value={fee.label}
            onChange={(e) =>
              onUpdate({ label: e.target.value.slice(0, 60) })
            }
            placeholder="What's this fee for?"
            className="glass-input h-10 flex-1 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
        ) : (
          <span className="flex-1 text-sm text-white/75">
            {cat.description}
          </span>
        )}
        <div className="relative w-24 shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-white/40">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amountDraft}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setAmountDraft(digits);
              onUpdate({
                amount_cents: digits ? parseInt(digits, 10) * 100 : 0,
              });
            }}
            placeholder="0"
            className="glass-input h-10 w-full px-2 pl-6 text-right text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${cat.title} fee`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-300 active:scale-90"
        >
          <X size={14} />
        </button>
      </div>
      {/* Server-only: shift end time. Start is the event start time
          (shown for context). */}
      {fee.tag === "server" && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-white/40">
              Starts
            </span>
            <span className="mt-0.5 block text-sm font-medium text-white/75">
              {eventStartTime ? formatTime12h(eventStartTime) : "Event start"}
            </span>
          </div>
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Ends
            </span>
            <TimePicker12h
              value={fee.shift_end_time ?? ""}
              onChange={(v) => onUpdate({ shift_end_time: v || null })}
              placeholder="Pick shift end"
              minTime={eventStartTime ?? null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Format "HH:MM" 24-hour into "h:MM AM/PM" for display. Used in the
 *  preview + the shift-end label so the creator + customer see times
 *  in the same idiom they typed. */
function formatTime12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h24 = parseInt(m[1], 10);
  const minute = m[2];
  if (isNaN(h24)) return hhmm;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minute} ${ampm}`;
}
