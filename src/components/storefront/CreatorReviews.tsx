"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  reviewer_name: string;
}

/**
 * Reviews tab content for the public storefront. Self-fetches the
 * creator's customer reviews on mount (the parent only renders this
 * when the Reviews tab is active, so the request is deferred until the
 * visitor actually asks for it).
 *
 * Seeds the summary header from the denormalized aggregate passed down
 * from the storefront loader so the average/count paint instantly,
 * then fills the list once the fetch resolves.
 */
export function CreatorReviews({
  creatorId,
  averageRating,
  reviewCount,
}: {
  creatorId: string | null;
  averageRating: number | null;
  reviewCount: number;
}) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // Summary (avg + count) seeded from the denormalized creator aggregate
  // for an instant first paint, then overwritten with the live values the
  // reviews endpoint computes from the actual rows. The aggregate can lag
  // (its write goes through the service-role client), so the fetched
  // numbers are the source of truth once they land — that's what keeps the
  // header from claiming "New / no reviews" while real reviews render below.
  const [summary, setSummary] = useState<{
    average: number | null;
    count: number;
  }>({ average: averageRating, count: reviewCount });

  useEffect(() => {
    if (!creatorId) {
      setState("ready");
      setReviews([]);
      setSummary({ average: null, count: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/creators/${creatorId}/reviews`);
        if (!res.ok) throw new Error("bad status");
        const json = await res.json();
        if (cancelled) return;
        const fetched = (json?.data?.reviews as Review[]) ?? [];
        setReviews(fetched);
        // Prefer the endpoint's computed aggregate; fall back to deriving
        // it from the returned rows so the summary always matches the list.
        const count =
          typeof json?.data?.count === "number"
            ? json.data.count
            : fetched.length;
        const average =
          typeof json?.data?.average === "number"
            ? json.data.average
            : fetched.length > 0
              ? Math.round(
                  (fetched.reduce((s, r) => s + r.rating, 0) / fetched.length) *
                    10
                ) / 10
              : null;
        setSummary({ average, count });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  return (
    <div className="px-4 py-4">
      {/* Summary header */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="text-center">
          <p className="text-3xl font-black leading-none text-white">
            {summary.average != null ? summary.average.toFixed(1) : "—"}
          </p>
          <StarRow rating={Math.round(summary.average ?? 0)} size={13} />
          <p className="mt-1 text-[11px] text-white/40">
            {summary.count} {summary.count === 1 ? "review" : "reviews"}
          </p>
        </div>
        <div className="flex-1 text-sm text-white/60">
          {summary.count > 0
            ? "What customers say after their orders."
            : "No reviews yet — be the first to order and leave one."}
        </div>
      </div>

      {/* List */}
      <div className="mt-3 space-y-2">
        {state === "loading" && (
          <p className="py-10 text-center text-sm text-white/40">
            Loading reviews…
          </p>
        )}

        {state === "error" && (
          <p className="py-10 text-center text-sm text-white/40">
            Couldn&apos;t load reviews. Pull to refresh.
          </p>
        )}

        {state === "ready" && reviews && reviews.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
              <MessageSquareText size={24} className="text-white/20" />
            </div>
            <p className="text-center text-sm text-white/50">
              No reviews yet.
            </p>
          </div>
        )}

        {state === "ready" &&
          reviews &&
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
            >
              <div className="flex items-center justify-between">
                <StarRow rating={r.rating} size={14} />
                <span className="text-[11px] text-white/35">
                  {timeAgo(r.created_at)}
                </span>
              </div>
              {r.body && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/80">
                  {r.body}
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-white/45">
                — {r.reviewer_name}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}

function StarRow({ rating, size }: { rating: number; size: number }) {
  return (
    <div className="mt-1 flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={cn(n <= rating ? "text-yellow-400" : "text-white/15")}
          fill={n <= rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

/** Compact relative time: "2d", "3w", "Jun 1". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
