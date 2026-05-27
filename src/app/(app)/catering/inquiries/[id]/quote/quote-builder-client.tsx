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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
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

interface Props {
  inquiry: InquiryRow;
  menuListings: MenuListing[];
}

const DEPOSIT_PERCENT = 30;

const PRESET_FEES = [
  { label: "Delivery", value: 50 },
  { label: "Labor (per server)", value: 150 },
  { label: "Setup", value: 75 },
];

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function dollarsToCents(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v) || 0;
  return Math.max(0, Math.round(n * 100));
}

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
        unit_price_cents: dollarsToCents(l.price),
        listing_id: l.id,
      }));
  });

  const [feesCents, setFeesCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [expiresDays, setExpiresDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Suggest extras based on inquiry — if the customer asked for a server
  // and the creator hasn't added one, surface a button.
  useEffect(() => {
    // Auto-suggest server fee on first load if the customer asked for one
    // and no fee is set yet. Creator can edit/zero out.
    if (inquiry.needs_server && feesCents === 0) {
      // Don't auto-add — just highlight the preset button via UI hint.
    }
  }, [inquiry.needs_server, feesCents]);

  // ── Derived totals ────────────────────────────────────────
  const foodSubtotalCents = useMemo(
    () => items.reduce((acc, it) => acc + it.qty * it.unit_price_cents, 0),
    [items]
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
        unit_price_cents: dollarsToCents(l.price),
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
    <div className="flex min-h-[100dvh] flex-col bg-[#0A0A0A] pb-[calc(7rem+env(safe-area-inset-bottom))]">
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
                <li
                  key={it.uid}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) =>
                        updateItem(it.uid, {
                          name: e.target.value.slice(0, 200),
                        })
                      }
                      placeholder="Item name"
                      className="glass-input h-10 flex-1 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(it.uid)}
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
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={it.qty}
                        onChange={(e) =>
                          updateItem(it.uid, {
                            qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="glass-input h-10 w-full px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
                        Unit price
                      </span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={(it.unit_price_cents / 100).toFixed(2)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d.]/g, "");
                            updateItem(it.uid, {
                              unit_price_cents: dollarsToCents(v),
                            });
                          }}
                          className="glass-input h-10 w-full px-3 pl-7 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                        />
                      </div>
                    </label>
                  </div>
                  <p className="mt-2 text-right text-xs text-white/50">
                    Line total:{" "}
                    <span className="font-semibold text-white/80">
                      {money(it.qty * it.unit_price_cents)}
                    </span>
                  </p>
                </li>
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

          {/* Fees */}
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
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={(feesCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, "");
                    setFeesCents(dollarsToCents(v));
                  }}
                  className="glass-input h-11 w-full px-3 pl-7 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_FEES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setFeesCents((prev) => prev + dollarsToCents(p.value))
                    }
                    className="rounded-full border border-white/[0.10] px-2.5 py-1 text-[11px] text-white/60 hover:text-white/90 active:scale-95"
                  >
                    + {p.label} ${p.value}
                  </button>
                ))}
                {feesCents > 0 && (
                  <button
                    type="button"
                    onClick={() => setFeesCents(0)}
                    className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-red-300/80 hover:text-red-200 active:scale-95"
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Tax */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-white/70">Tax</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={(taxCents / 100).toFixed(2)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.]/g, "");
                  setTaxCents(dollarsToCents(v));
                }}
                className="glass-input h-11 w-full px-3 pl-7 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                placeholder="0.00"
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
              {feesCents > 0 && (
                <Row label="Fees" value={money(feesCents)} />
              )}
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

      {/* Sticky send bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px] backdrop-saturate-[180%]">
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
