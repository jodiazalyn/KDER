import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard (Store) loading skeleton.
 *
 * Rendered automatically by Next.js while the dashboard's client
 * component mounts + does its initial parallel data fetch (profile
 * + listings + orders). Replaces the previous "blank page until
 * everything's ready" experience; the user sees structured shimmer
 * the instant they tap the Store tab.
 *
 * Layout mirrors `dashboard/page.tsx`: profile avatar + name + tagline,
 * a share-link card, a stats row, and a 2-col plate grid. Match the
 * rhythm so the page→content transition isn't a layout jolt.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      {/* Profile header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </div>

      {/* Share-link card */}
      <Skeleton className="mt-6 h-24 w-full rounded-2xl" />

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>

      {/* Plates section header */}
      <div className="mt-8 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      {/* Plate grid — 2 columns of square thumbnails */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
