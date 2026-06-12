"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";

/**
 * Sticky "you have a new order" banner shown across the creator app
 * shell (home, orders, plates, calendar, earn, chat). Mounted once in
 * (app)/layout above the page content.
 *
 * Polls /api/v1/orders/pending-count every 20s. When there's at least
 * one PENDING order it pins a glass banner to the top of the viewport
 * (respecting the iOS safe-area inset) linking into the order page so
 * the creator can accept/decline. Renders nothing when count is 0, so
 * non-creators / empty states never see it.
 */
const POLL_MS = 20_000;

export function NewOrderBanner() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [latestId, setLatestId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/orders/pending-count", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (cancelled) return;
        setCount(Number(body?.data?.count) || 0);
        setLatestId(body?.data?.latest_order_id ?? null);
      } catch {
        // Silent — banner just won't show.
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (count === 0) return null;

  const href = latestId ? `/orders/${latestId}` : "/orders";
  const label =
    count === 1
      ? "1 new order needs your response"
      : `${count} new orders need your response`;

  return (
    <div
      className="sticky top-0 z-40 px-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
    >
      <button
        type="button"
        onClick={() => router.push(href)}
        aria-label={label}
        className="flex w-full items-center gap-3 rounded-2xl border border-green-400/[0.30] bg-green-900/[0.35] px-4 py-3 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-all hover:border-green-400/[0.45] hover:bg-green-900/[0.45] active:scale-[0.99]"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/25 text-green-200">
          <Bell size={18} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
          </span>
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-green-50">{label}</p>
          <p className="text-xs text-green-200/70">
            Tap to review and accept before it expires.
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-green-200/70" />
      </button>
    </div>
  );
}
