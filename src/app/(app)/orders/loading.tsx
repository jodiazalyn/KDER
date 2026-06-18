import { Skeleton } from "@/components/ui/skeleton";
import { KderSpinner } from "@/components/ui/kder-spinner";

/**
 * Orders loading skeleton. Spinning KDER mark + shape-mirroring
 * skeleton below.
 */
export default function OrdersLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <div className="flex justify-center py-6">
        <KderSpinner size={48} />
      </div>

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
            className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3"
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
