import { Skeleton } from "@/components/ui/skeleton";
import { KderSpinner } from "@/components/ui/kder-spinner";

/**
 * Listings (Plates) loading skeleton. Branded KDER spinner at
 * top + shape-mirroring skeleton below.
 */
export default function ListingsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <div className="flex justify-center py-6">
        <KderSpinner size={48} />
      </div>

      {/* Header row: title + new-plate CTA */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      {/* Tab row (active / drafts / archived) */}
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      {/* Plate cards — list (not grid) on the listings page */}
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
          >
            <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
