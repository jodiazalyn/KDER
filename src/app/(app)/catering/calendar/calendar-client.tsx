"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, X, Repeat, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import type { CreatorBlackout } from "@/types";
import { cn } from "@/lib/utils";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";

interface Props {
  /** Hydrated server-side via loadCreatorBlackouts. The
   *  client never refetches on mount — it owns this list and
   *  mutates it optimistically (POST/DELETE blackout). */
  initialBlackouts: CreatorBlackout[];
  /** Count of inquiries with status='open' for the badge on
   *  the inbox link. Hydrated server-side, never refreshed
   *  here (the OrdersClient + tab badge handle their own
   *  freshness). */
  initialOpenInquiryCount: number;
}

/**
 * Calendar dashboard.
 *
 * State model:
 *   - `month`     — the first day of the visible month
 *   - `blackouts` — seeded from server props; we filter
 *                   client-side per month so paging doesn't refetch
 *   - `selectedDate` — opens the right-side day drawer
 *
 * Recurring blackouts (weekday rules) are expanded into specific
 * dates inside the visible month for rendering. We don't expand
 * forever — only what's on screen.
 */
export default function CalendarClient({
  initialBlackouts,
  initialOpenInquiryCount,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  // Seeded from the server. Mutations (addOneOff, addRecurring,
  // removeBlackout) keep updating this list optimistically.
  const [blackouts, setBlackouts] =
    useState<CreatorBlackout[]>(initialBlackouts);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  // Coachmark anchor — wraps the rendered MonthCalendar so the
  // first-time tip points at the actual grid.
  const calendarCoachRef = useRef<HTMLDivElement>(null);
  // No more "loading" state — open-inquiry count arrives in the
  // initial render. Pass-through prop.
  const openInquiryCount = initialOpenInquiryCount;
  // Loading is always false now (server hydrated). Keep the
  // variable so the JSX below can reference it without churn.
  const loading = false;

  // ── Derive blackout dates for the visible month ────────────
  // Expand recurring (weekday) rules into specific dates inside
  // the visible window so MonthCalendar gets a flat Set of ISO
  // strings to highlight.
  const blackoutDates = useMemo(() => {
    const set = new Set<string>();
    const year = month.getFullYear();
    const monthIdx = month.getMonth();

    for (const b of blackouts) {
      if (b.kind === "one_off" && b.blackout_date) {
        set.add(b.blackout_date);
      } else if (b.kind === "recurring" && b.weekday !== null) {
        // Walk every day of the visible month, flag matches.
        for (let d = 1; d <= 31; d++) {
          const dt = new Date(year, monthIdx, d);
          if (dt.getMonth() !== monthIdx) break; // overflow guard
          if (dt.getDay() === b.weekday) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const day = String(dt.getDate()).padStart(2, "0");
            set.add(`${y}-${m}-${day}`);
          }
        }
      }
    }
    return set;
  }, [blackouts, month]);

  // Blackouts that apply specifically to the currently-selected
  // date (so the drawer can show + offer to remove them).
  const blackoutsForSelected = useMemo(() => {
    if (!selectedDate) return [];
    const dt = new Date(selectedDate + "T00:00:00");
    return blackouts.filter((b) => {
      if (b.kind === "one_off") return b.blackout_date === selectedDate;
      return b.weekday === dt.getDay();
    });
  }, [blackouts, selectedDate]);

  // ── Actions ────────────────────────────────────────────────
  const addOneOff = async (iso: string) => {
    setBusyDate(iso);
    try {
      const res = await fetch("/api/v1/catering/blackouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "one_off", blackout_date: iso }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't add blackout.");
        return;
      }
      if (!body.data?.already_existed && body.data?.blackout) {
        setBlackouts((prev) => [...prev, body.data.blackout]);
        toast.success("Date marked unavailable.");
      } else {
        toast.message("That date was already marked.");
      }
    } finally {
      setBusyDate(null);
    }
  };

  const removeBlackout = async (id: string) => {
    setBusyDate(selectedDate);
    try {
      const res = await fetch(`/api/v1/catering/blackouts/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't remove blackout.");
        return;
      }
      setBlackouts((prev) => prev.filter((b) => b.id !== id));
      toast.success("Blackout removed.");
    } finally {
      setBusyDate(null);
    }
  };

  const addRecurring = async (weekday: number) => {
    try {
      const res = await fetch("/api/v1/catering/blackouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "recurring", weekday }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't add recurring blackout.");
        return;
      }
      if (!body.data?.already_existed && body.data?.blackout) {
        setBlackouts((prev) => [...prev, body.data.blackout]);
        toast.success("Recurring blackout added.");
      } else {
        toast.message("That weekday is already a blackout.");
      }
      setRecurringOpen(false);
    } catch {
      toast.error("Couldn't add recurring blackout.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground">
              Catering bookings &amp; blackout dates
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Inquiry inbox shortcut — only render once we know there's
                at least one, otherwise it's empty noise. */}
            {openInquiryCount > 0 && (
              <Link
                href="/catering/inquiries"
                className="relative flex h-11 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-500/20 active:scale-95 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                aria-label={`${openInquiryCount} open catering inquir${openInquiryCount === 1 ? "y" : "ies"}`}
              >
                <Inbox size={14} />
                {openInquiryCount}{" "}
                {openInquiryCount === 1 ? "Inquiry" : "Inquiries"}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setRecurringOpen((o) => !o)}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-all active:scale-95",
                recurringOpen
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
              aria-pressed={recurringOpen}
              aria-label="Manage recurring blackouts"
            >
              <Repeat size={14} />
              Recurring
            </button>
          </div>
        </div>
      </div>

      {/* Recurring weekday picker — collapsible panel below header */}
      {recurringOpen && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="mx-auto max-w-lg">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Tap a weekday to always block it (e.g. always closed Mondays).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (label, weekday) => {
                  const active = blackouts.some(
                    (b) => b.kind === "recurring" && b.weekday === weekday
                  );
                  const recurring = blackouts.find(
                    (b) => b.kind === "recurring" && b.weekday === weekday
                  );
                  return (
                    <button
                      key={weekday}
                      type="button"
                      onClick={() =>
                        active && recurring
                          ? removeBlackout(recurring.id)
                          : addRecurring(weekday)
                      }
                      aria-pressed={active}
                      className={cn(
                        "h-11 min-w-[3rem] rounded-full border px-3 text-xs font-semibold transition-all active:scale-95",
                        active
                          ? "border-red-400/40 bg-red-500/10 text-red-700 dark:bg-red-950/40 dark:text-red-200"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mx-auto max-w-lg">
          {loading ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-muted/30">
              <Loader2
                size={24}
                className="animate-spin text-muted-foreground"
                aria-label="Loading calendar"
              />
            </div>
          ) : (
            <div ref={calendarCoachRef}>
              <MonthCalendar
                month={month}
                blackoutDates={blackoutDates}
                selectedDate={selectedDate}
                onDayClick={(iso) =>
                  setSelectedDate((cur) => (cur === iso ? null : iso))
                }
                onPrevMonth={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1)
                  )
                }
                onNextMonth={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1)
                  )
                }
              />
            </div>
          )}

          {/* Day drawer (inline, below the calendar — feels more
              natural on mobile than a slide-in panel) */}
          {selectedDate && (
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {blackoutsForSelected.length === 0
                      ? "Available for bookings."
                      : "Blacked out — customers can't book."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  aria-label="Close day details"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>

              {/* If there's no blackout: offer to add one */}
              {blackoutsForSelected.length === 0 && (
                <button
                  type="button"
                  onClick={() => addOneOff(selectedDate)}
                  disabled={busyDate === selectedDate}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border text-sm font-medium text-foreground/80 transition-all hover:bg-muted/60 active:scale-95 disabled:opacity-50"
                >
                  {busyDate === selectedDate ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      Mark unavailable
                    </>
                  )}
                </button>
              )}

              {/* If there ARE blackouts: list each with a remove button.
                  Recurring blackouts can't be removed from this view
                  (since they apply across many dates) — surface a hint. */}
              {blackoutsForSelected.length > 0 && (
                <ul className="space-y-2">
                  {blackoutsForSelected.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {b.kind === "one_off"
                            ? "This date"
                            : `Every ${
                                ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
                                  b.weekday ?? 0
                                ]
                              }`}
                        </p>
                        {b.reason && (
                          <p className="truncate text-xs text-muted-foreground">
                            {b.reason}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBlackout(b.id)}
                        disabled={busyDate === selectedDate}
                        aria-label="Remove blackout"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 active:scale-90 disabled:opacity-50"
                      >
                        {busyDate === selectedDate ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <X size={18} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Empty hint for first-time users */}
          {!loading && blackouts.length === 0 && !selectedDate && (
            <p className="mt-4 text-center text-xs text-muted-foreground/60">
              Tap any date to mark it unavailable. Bookings will appear here
              once customers start placing catering orders.
            </p>
          )}
        </div>
      </div>

      {/* First-time tip on the calendar grid — explains tap-to-block
          and the Recurring weekday rules. Only fires after blackouts
          have loaded so the spotlight doesn't land on the spinner. */}
      {!loading && (
        <Coachmark
          id="creator-catering-calendar"
          copy={COACHMARK_COPY["creator-catering-calendar"]}
          targetRef={calendarCoachRef}
          showDelayMs={400}
        />
      )}
    </div>
  );
}
