"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight Tailwind-only month grid.
 *
 * Why a custom component vs react-big-calendar: we render a single
 * month view, no drag/drop, no multi-day events, no week/day views.
 * Pulling in a 50KB+ calendar library for that is overkill — and the
 * existing glass-card / kder-green design system would need overrides
 * everywhere to look right. ~150 lines of bespoke layout is cheaper
 * to own.
 *
 * Renders 7-col × 6-row grid (always 42 cells) so adjacent months'
 * leading/trailing days fill the edges and the layout never reflows
 * as the user pages forward/back.
 *
 * Day badges:
 *   - `bookingsByDate` — pass a number per ISO date string for the
 *     booking count badge. PR 1 just passes an empty map (no bookings
 *     yet); PR 3 will populate it from `catering_bookings`.
 *   - `blackoutDates` — ISO date strings the creator marked off (or
 *     that fall on a recurring blackout weekday).
 */

export interface MonthCalendarProps {
  /** First day of the month being displayed. Time portion ignored. */
  month: Date;
  /** ISO YYYY-MM-DD → number of bookings on that date. */
  bookingsByDate?: Record<string, number>;
  /** ISO YYYY-MM-DD strings that are blacked out (one-off or recurring). */
  blackoutDates?: Set<string>;
  /** Currently selected date (highlighted). */
  selectedDate?: string | null;
  /** Fires when a cell in the visible month is tapped. */
  onDayClick?: (isoDate: string) => void;
  /** Page to previous month. */
  onPrevMonth?: () => void;
  /** Page to next month. */
  onNextMonth?: () => void;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Format a Date as YYYY-MM-DD without timezone surprises. */
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Generates the 42 cells of the calendar grid. */
function buildGrid(month: Date) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun

  // Start from the Sunday that includes the 1st (may be in previous month).
  const gridStart = new Date(year, monthIdx, 1 - startOffset);

  const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    cells.push({
      date: d,
      iso: toIso(d),
      inMonth: d.getMonth() === monthIdx,
    });
  }
  return cells;
}

export function MonthCalendar({
  month,
  bookingsByDate = {},
  blackoutDates = new Set(),
  selectedDate = null,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const cells = useMemo(() => buildGrid(month), [month]);
  const todayIso = toIso(new Date());
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-border">
      {/* Header: month label + paging arrows. Both arrows are 44×44
          tap targets per WCAG / Apple HIG. */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-90"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h2 className="text-base font-semibold text-foreground" aria-live="polite">
          {monthLabel}
        </h2>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-90"
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Weekday header strip */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            aria-hidden="true"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div role="grid" aria-label={monthLabel} className="grid grid-cols-7">
        {cells.map((cell) => {
          const count = bookingsByDate[cell.iso] ?? 0;
          const isBlackout = blackoutDates.has(cell.iso);
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;
          const isInteractive = cell.inMonth && !!onDayClick;

          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              tabIndex={isInteractive ? 0 : -1}
              disabled={!isInteractive}
              aria-label={`${cell.date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}${count > 0 ? `, ${count} booking${count === 1 ? "" : "s"}` : ""}${
                isBlackout ? ", blackout" : ""
              }`}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected || undefined}
              onClick={() => isInteractive && onDayClick?.(cell.iso)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center border-b border-r border-border transition-colors",
                // Trailing right column + bottom row: no border edge
                "[&:nth-child(7n)]:border-r-0",
                // Cells in adjacent months are dim and non-interactive
                cell.inMonth ? "text-foreground" : "text-muted-foreground/40",
                // Interactive states
                isInteractive &&
                  "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40",
                // Blackout = subtle red wash so it reads as "unavailable"
                isBlackout &&
                  cell.inMonth &&
                  "bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:bg-red-950/30 dark:text-red-200/70 dark:hover:bg-red-950/40",
                // Selected = green ring
                isSelected &&
                  "bg-primary/10 ring-1 ring-inset ring-primary/40"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium leading-none",
                  isToday &&
                    cell.inMonth &&
                    !isSelected &&
                    "rounded-full bg-primary px-2 py-0.5 text-primary-foreground"
                )}
              >
                {cell.date.getDate()}
              </span>
              {/* Booking count badge: small kder-green dot with number */}
              {count > 0 && cell.inMonth && (
                <span
                  className="mt-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {count}
                </span>
              )}
              {/* Blackout indicator: subtle diagonal stripe */}
              {isBlackout && cell.inMonth && count === 0 && (
                <span
                  className="mt-1 h-0.5 w-3 rotate-[-12deg] rounded bg-red-500/70 dark:bg-red-400/60"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend strip */}
      <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Booking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rotate-[-12deg] rounded bg-red-500/70 dark:bg-red-400/60" />
          Blackout
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-primary px-1.5 py-0 text-[8px] font-bold text-primary-foreground">
            {new Date().getDate()}
          </span>
          Today
        </span>
      </div>
    </div>
  );
}
