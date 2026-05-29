"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 12-hour AM/PM time picker, modernized.
 *
 * Why the rewrite: the previous incarnation was three native
 * <select>s with "HH" / "MM" / "AM/PM" placeholders. A creator
 * tester said: "no one even knows what HH and MM mean." The three
 * pills also fought for space on narrow screens and got clipped.
 *
 * The new shape — same pattern as Cal.com, Notion, Apple
 * Reminders: one tap-target per field that opens a Radix Popover
 * with a scrollable list of 15-minute slots. The trigger displays
 * the actual chosen time (`7:30 PM`) or a plain-English
 * placeholder ("Select start time"). The button is the entire
 * affordance — no separate hour/minute/AM-PM pieces.
 *
 * Value contract is UNCHANGED so every existing call site keeps
 * working without import churn:
 *   - `value` is "" when unset, or "HH:MM[:SS]" 24-hour
 *   - `onChange` returns the same shape: "" or "HH:MM"
 *
 * New optional props:
 *   - `placeholder` — the trigger text when value is empty
 *   - `minTime` — hide slots ≤ minTime. Lets the End picker
 *     depend on Start without parent coordination.
 */

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Accessible label for the trigger button. Pair with a visible
   *  parent label via aria-labelledby. */
  ariaLabelledBy?: string;
  /** Text shown on the trigger when no value is picked. Defaults
   *  to "Select time". Override per usage so the affordance is
   *  self-explanatory ("Select start time", "Pick shift end"). */
  placeholder?: string;
  /** Optional lower bound ("HH:MM" 24-hour). Slots <= minTime are
   *  hidden from the popover. Use for End pickers so the customer
   *  can't pick "end before start". */
  minTime?: string | null;
  className?: string;
}

// ── Slot bank ────────────────────────────────────────────────
// Pre-computed once at module load. 4:00 AM → 11:45 PM in 15-min
// steps. Catering events don't realistically happen at 2 AM, and
// trimming the early hours keeps the scroll list short enough to
// scan without overwhelming the picker.
const START_HOUR_24 = 4;
const END_HOUR_24 = 23;
const MINUTE_STEP = 15;

const SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = START_HOUR_24; h <= END_HOUR_24; h += 1) {
    for (let m = 0; m < 60; m += MINUTE_STEP) {
      out.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
    }
  }
  return out;
})();

/** "19:30" → "7:30 PM". Empty / malformed input returns "". */
function formatTime12(value: string): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return "";
  const h24 = parseInt(m[1], 10);
  const minute = m[2];
  if (h24 < 0 || h24 > 23) return "";
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minute} ${ampm}`;
}

/** "HH:MM[:SS]" → "HH:MM" so equality checks against SLOTS work
 *  regardless of whether the stored value carries seconds. */
function normalize(value: string): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return "";
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
}

export function TimePicker12h({
  value,
  onChange,
  ariaLabelledBy,
  placeholder = "Select time",
  minTime,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const normalizedValue = useMemo(() => normalize(value), [value]);
  const normalizedMin = useMemo(
    () => (minTime ? normalize(minTime) : ""),
    [minTime]
  );

  // Visible slots — filter out anything <= minTime so the End
  // picker physically can't show pre-start times.
  const visibleSlots = useMemo(() => {
    if (!normalizedMin) return SLOTS;
    return SLOTS.filter((s) => s > normalizedMin);
  }, [normalizedMin]);

  const displayText = formatTime12(value);

  // When the popover opens with an existing selection, scroll the
  // chosen slot into view so the user lands where they left off.
  // Deferred until the next frame so Radix's positioning settles
  // before we measure.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy ? undefined : placeholder}
          className={cn(
            // Pill matches glass-input height + look. Sized tight
            // so placeholders like "Select start time" fit even in
            // a half-width column on a 375px viewport without
            // truncating mid-word. Min-w-0 on the inner span is
            // what actually lets the parent flex container shrink
            // the text below its intrinsic width.
            "group flex h-12 w-full min-w-0 items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.04] pl-2.5 pr-2 text-left text-white transition-colors",
            "hover:border-white/[0.18] hover:bg-white/[0.06]",
            "focus-visible:border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30",
            "data-[state=open]:border-emerald-400/50 data-[state=open]:bg-white/[0.06]",
            className
          )}
        >
          <Clock
            size={14}
            aria-hidden
            className={cn(
              "shrink-0 transition-colors",
              displayText ? "text-emerald-300" : "text-white/40"
            )}
          />
          <span
            className={cn(
              // truncate + min-w-0 lets the text shrink/ellipsize
              // inside the parent flex without forcing the chevron
              // off-screen. text-sm (14px) keeps the longest
              // placeholders inside the pill on a half-width
              // mobile column.
              "min-w-0 flex-1 truncate text-sm leading-none",
              displayText ? "font-semibold text-white" : "text-white/50"
            )}
          >
            {displayText || placeholder}
          </span>
          <ChevronDown
            size={14}
            aria-hidden
            className="shrink-0 text-white/40 transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // glass-card gives the bg + blur + border; we layer the
          // sizing + scroll + animation here.
          className={cn(
            "glass-card z-[70] w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-2xl p-1 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        >
          <div
            ref={listRef}
            role="listbox"
            aria-label={placeholder}
            className="max-h-[18rem] overflow-y-auto py-1 [scrollbar-width:thin]"
          >
            {visibleSlots.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-white/50">
                No times available — set a start time first.
              </p>
            ) : (
              visibleSlots.map((slot) => {
                const selected = slot === normalizedValue;
                return (
                  <button
                    key={slot}
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-emerald-900/50 text-emerald-200 ring-1 ring-inset ring-emerald-400/30"
                        : "text-white/85 hover:bg-white/[0.06] active:bg-white/[0.10]"
                    )}
                  >
                    <span className="tabular-nums">
                      {formatTime12(slot)}
                    </span>
                    {selected && (
                      <Check size={14} className="text-emerald-300" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
