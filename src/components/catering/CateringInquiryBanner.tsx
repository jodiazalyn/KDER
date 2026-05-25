"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, ChevronRight } from "lucide-react";

/**
 * Banner shown above the Orders list. Surfaces any open catering
 * inquiries (which live in their own table, not `orders`) so creators
 * notice them while triaging regular plate orders.
 *
 * Self-fetches on mount + polls every 60s. Renders nothing while
 * loading or when count is 0 — fails silently if the user isn't a
 * creator or the network errors out.
 */
export function CateringInquiryBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/catering/inquiries?status=open", {
          credentials: "include",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setCount(
          Array.isArray(body?.data?.inquiries) ? body.data.inquiries.length : 0
        );
      } catch {
        // Ignore — banner just won't show.
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/catering/inquiries"
      className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/[0.20] bg-amber-900/[0.20] px-4 py-3 transition-all hover:border-amber-400/[0.35] hover:bg-amber-900/[0.30] active:scale-[0.99]"
      aria-label={`${count} new catering inquir${count === 1 ? "y" : "ies"} waiting for a quote`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
        <Inbox size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-100">
          {count} new catering{" "}
          {count === 1 ? "inquiry" : "inquiries"}
        </p>
        <p className="text-xs text-amber-200/70">
          Tap to review and send back a quote.
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-amber-300/70" />
    </Link>
  );
}
