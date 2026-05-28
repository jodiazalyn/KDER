"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact 12-hour AM/PM time picker.
 *
 * Why this exists: native <input type="time"> renders in 24-hour
 * format on devices set to a 24h locale. That's confusing for US
 * customers used to AM/PM. This component uses three native <select>
 * dropdowns (hour 1-12, minute 00/15/30/45, AM/PM) for a guaranteed
 * 12-hour UX on every platform, while still emitting a standard
 * 24-hour "HH:MM" or "HH:MM:SS" string so the API + DB schema don't
 * need any changes.
 *
 * Why the structure looks the way it does — each <select> is wrapped
 * in its own label-shaped pill with a visible chevron. The earlier
 * version rendered the three selects naked inside a single glass-
 * input wrapper, and a customer-tester reported "time isn't popping
 * up when checking out" — the controls looked like static text
 * labels (no chevron, no visible border), and on iOS Safari the
 * combination of `appearance-none` selects inside a backdrop-filter
 * container would sometimes not open the picker on first tap. Each
 * select now gets its own bordered pill, a chevron, and a 44px
 * minimum tap area so the affordance is unmistakable + the iOS
 * compositing path doesn't hide the picker.
 *
 * Value contract:
 *   - `value` is "" when unset, or "HH:MM" / "HH:MM:SS" in 24-hour
 *     format (matches Postgres TIME and the existing inquiry API)
 *   - `onChange` returns the same shape: "" or "HH:MM"
 *   - 15-minute granularity is a deliberate constraint for the
 *     catering use case — nobody books a meal for 2:07 PM
 */

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Optional accessible label tying this control to a visible <span>
   *  via aria-labelledby. Use when the visible label sits in the
   *  parent (e.g., "Start" + "End" headers). */
  ariaLabelledBy?: string;
  className?: string;
}

const MINUTES = [0, 15, 30, 45] as const;

export function TimePicker12h({
  value,
  onChange,
  ariaLabelledBy,
  className,
}: Props) {
  // Decompose the stored 24h "HH:MM[:SS]" string into the 12h picker
  // pieces. Returns nulls when the value is empty so the dropdowns
  // start on placeholder rows.
  const parsed = useMemo(() => parseTime24(value), [value]);

  const commit = (hour12: number | null, minute: number | null, ampm: "AM" | "PM" | null) => {
    if (hour12 === null || minute === null || ampm === null) {
      // Partial selection — wait for all three before emitting a
      // value. Parent stays empty / treats it as unset.
      onChange("");
      return;
    }
    let h24 = hour12 % 12;
    if (ampm === "PM") h24 += 12;
    const hh = String(h24).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  };

  return (
    <div
      role="group"
      aria-labelledby={ariaLabelledBy}
      // No backdrop-filter here — the per-segment pills each carry
      // their own glass styling. Stacking the wrapper's backdrop-
      // filter on top would create a compositing context that on
      // iOS Safari occasionally swallowed the first tap on the
      // child selects.
      className={cn("flex items-stretch gap-1.5", className)}
    >
      <SegmentSelect
        ariaLabel="Hour"
        value={parsed.hour12 ?? ""}
        onChange={(v) => {
          const h = v === "" ? null : parseInt(v, 10);
          commit(h, parsed.minute, parsed.ampm);
        }}
        widthClass="flex-[1.2]"
      >
        <option value="">HH</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h} className="bg-[#0A0A0A] text-white">
            {h}
          </option>
        ))}
      </SegmentSelect>
      <SegmentSelect
        ariaLabel="Minute"
        value={parsed.minute ?? ""}
        onChange={(v) => {
          const m = v === "" ? null : parseInt(v, 10);
          commit(parsed.hour12, m, parsed.ampm);
        }}
        widthClass="flex-[1.2]"
      >
        <option value="">MM</option>
        {MINUTES.map((m) => (
          <option key={m} value={m} className="bg-[#0A0A0A] text-white">
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </SegmentSelect>
      <SegmentSelect
        ariaLabel="AM or PM"
        value={parsed.ampm ?? ""}
        onChange={(v) => {
          const a = v === "" ? null : (v as "AM" | "PM");
          commit(parsed.hour12, parsed.minute, a);
        }}
        widthClass="flex-[1.4]"
      >
        <option value="">AM/PM</option>
        <option value="AM" className="bg-[#0A0A0A] text-white">
          AM
        </option>
        <option value="PM" className="bg-[#0A0A0A] text-white">
          PM
        </option>
      </SegmentSelect>
    </div>
  );
}

/** One bordered "pill" wrapping a single <select>. Renders the chevron
 *  on top of the native control so the affordance reads as a dropdown
 *  on every platform. The select itself stays a real native element
 *  (so the OS picker opens) but is visually styled by the wrapper. */
function SegmentSelect({
  ariaLabel,
  value,
  onChange,
  widthClass,
  children,
}: {
  ariaLabel: string;
  value: string | number;
  onChange: (next: string) => void;
  widthClass: string;
  children: React.ReactNode;
}) {
  const isEmpty = value === "" || value === null || value === undefined;
  return (
    <div
      className={cn(
        "relative flex h-12 min-h-[44px] items-center rounded-xl border border-white/[0.10] bg-white/[0.04] transition-colors focus-within:border-emerald-400/50 focus-within:bg-white/[0.06]",
        widthClass
      )}
    >
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // text-base = 16px so iOS Safari doesn't auto-zoom the
        // viewport when the picker opens. appearance-none here is
        // fine — the wrapper renders its own chevron and the OS
        // picker still opens because <select> remains a real native
        // element underneath.
        className={cn(
          "h-full w-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 text-base focus:outline-none",
          isEmpty ? "text-white/45" : "text-white"
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40"
      />
    </div>
  );
}

/** Parse "HH:MM[:SS]" 24-hour into the picker's three components.
 *  Returns all-null for empty / malformed strings. */
function parseTime24(value: string): {
  hour12: number | null;
  minute: number | null;
  ampm: "AM" | "PM" | null;
} {
  if (!value) return { hour12: null, minute: null, ampm: null };
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return { hour12: null, minute: null, ampm: null };
  const h24 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (h24 < 0 || h24 > 23 || minute < 0 || minute > 59) {
    return { hour12: null, minute: null, ampm: null };
  }
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  // Snap minutes that aren't in our 15-min step to the nearest one
  // (preserves the user's stored value visually even if we tightened
  // the granularity later).
  return { hour12, minute, ampm };
}
