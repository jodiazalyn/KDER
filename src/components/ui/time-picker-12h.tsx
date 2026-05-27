"use client";

import { useMemo } from "react";
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
      className={cn(
        "glass-input flex h-12 items-center gap-0.5 rounded-xl px-2",
        className
      )}
    >
      <select
        aria-label="Hour"
        value={parsed.hour12 ?? ""}
        onChange={(e) => {
          const h = e.target.value === "" ? null : parseInt(e.target.value, 10);
          commit(h, parsed.minute, parsed.ampm);
        }}
        className="appearance-none bg-transparent px-2 py-1.5 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
      >
        <option value="">--</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h} className="bg-[#0A0A0A] text-white">
            {h}
          </option>
        ))}
      </select>
      <span className="text-white/40">:</span>
      <select
        aria-label="Minute"
        value={parsed.minute ?? ""}
        onChange={(e) => {
          const m = e.target.value === "" ? null : parseInt(e.target.value, 10);
          commit(parsed.hour12, m, parsed.ampm);
        }}
        className="appearance-none bg-transparent px-2 py-1.5 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
      >
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m} className="bg-[#0A0A0A] text-white">
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={parsed.ampm ?? ""}
        onChange={(e) => {
          const a = e.target.value === "" ? null : (e.target.value as "AM" | "PM");
          commit(parsed.hour12, parsed.minute, a);
        }}
        className="ml-1 appearance-none bg-transparent px-2 py-1.5 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
      >
        <option value="">--</option>
        <option value="AM" className="bg-[#0A0A0A] text-white">
          AM
        </option>
        <option value="PM" className="bg-[#0A0A0A] text-white">
          PM
        </option>
      </select>
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
