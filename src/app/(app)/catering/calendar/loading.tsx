import { Skeleton } from "@/components/ui/skeleton";

/**
 * Catering Calendar loading skeleton.
 *
 * Mirrors catering/calendar/calendar-client.tsx layout: title +
 * recurring CTA, month-grid placeholder (42 cells = 6 weeks ×
 * 7 days), legend row, and an upcoming-inquiries list.
 */
export default function CalendarLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      {/* Header — title + recurring CTA */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-44" />
        </div>
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>

      {/* Month nav row */}
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      {/* Weekday header */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-3 w-4" />
        ))}
      </div>

      {/* Day grid — 6 weeks × 7 days */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </main>
  );
}
