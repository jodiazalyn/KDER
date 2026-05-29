import { Skeleton } from "@/components/ui/skeleton";

/**
 * Orders loading skeleton.
 *
 * Mirrors orders/page.tsx layout: title + tab row (active /
 * completed / declined), then a list of OrderCards each showing
 * customer avatar + name + plate × qty + price + status badge.
 */
export default function OrdersLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      {/* Title */}
      <Skeleton className="h-7 w-28" />

      {/* Tab row */}
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      {/* Order rows */}
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
          >
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
