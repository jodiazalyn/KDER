import { Skeleton } from "@/components/ui/skeleton";
import { KderSpinner } from "@/components/ui/kder-spinner";

/**
 * Dashboard (Store) loading skeleton.
 *
 * Rendered by Next.js while the Server Component awaits its data.
 * The KderSpinner pins to the top so the rotating KDER mark is
 * the first thing the user sees on every tab switch — branded
 * affordance that the app is working. Skeletons below mirror the
 * page's actual shape so the transition to real content isn't a
 * layout jolt.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <div className="flex justify-center py-6">
        <KderSpinner size={48} />
      </div>

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
