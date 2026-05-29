import { Skeleton } from "@/components/ui/skeleton";

/**
 * Messages (Chat) loading skeleton.
 *
 * Mirrors messages/page.tsx layout: title + a list of conversation
 * rows each showing partner avatar + name + last-message preview +
 * timestamp.
 */
export default function MessagesLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      {/* Title */}
      <Skeleton className="h-7 w-20" />

      {/* Conversation list */}
      <div className="mt-5 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
