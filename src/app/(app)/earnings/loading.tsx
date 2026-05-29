import { Skeleton } from "@/components/ui/skeleton";

/**
 * Earnings loading skeleton.
 *
 * Sits over the brief window before the cached server render
 * arrives (every 60s the first request triggers a fresh
 * fan-out). Mirrors EarningsView layout: big balance hero, KYC
 * banner placeholder, a stats row, and a recent-transactions list.
 */
export default function EarningsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      {/* Title */}
      <Skeleton className="h-7 w-24" />

      {/* Balance hero card — big, top of page */}
      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-44" />
        <Skeleton className="mt-2 h-3 w-32" />
        <Skeleton className="mt-5 h-11 w-full rounded-full" />
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>

      {/* Transactions section */}
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </main>
  );
}
