"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  LayoutGrid,
  Bell,
  Calendar,
  Wallet,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 6 tabs is the practical max on a 375px viewport before labels wrap.
// Calendar sits between Orders and Earn — it's effectively another
// order-management surface (specifically for catering bookings + blackouts).
const tabs = [
  { href: "/dashboard", icon: Store, label: "Store" },
  { href: "/listings", icon: LayoutGrid, label: "Plates" },
  { href: "/orders", icon: Bell, label: "Orders" },
  { href: "/catering/calendar", icon: Calendar, label: "Calendar" },
  { href: "/earnings", icon: Wallet, label: "Earn" },
  { href: "/messages", icon: MessageCircle, label: "Chat" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  // Open-inquiry count powers the red dot on the Calendar tab. We poll
  // on mount + every 60s so creators see new requests show up without
  // needing a full page refresh. Fails silently — if the fetch errors
  // or the user isn't a creator, the badge just doesn't render.
  const [inquiryCount, setInquiryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        // Dedicated attention-count endpoint — returns just the
        // counts (no row payloads), and INCLUDES pending bookings
        // (the 4hr-clock items). The earlier version only counted
        // open inquiries, so creators could miss a paid-deposit
        // booking sitting in the 4hr accept window.
        const res = await fetch("/api/v1/catering/attention-count", {
          credentials: "include",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        const total =
          typeof body?.data?.total === "number" ? body.data.total : 0;
        setInquiryCount(total);
      } catch {
        // Ignore — badge just won't render.
      }
    };
    fetchCount();
    const iv = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  // Hide on fullscreen chat thread pages — matches Apple Messages / Instagram DMs pattern
  if (/^\/messages\/[^/]+/.test(pathname)) return null;

  return (
    <nav
      // Floating rounded "pill" nav (Uber-style): detached from the
      // screen edges, fully rounded, soft shadow, frosted-glass
      // substrate. The outer wrapper is pointer-events-none so taps in
      // the side gutters fall through to the page; the pill itself
      // re-enables pointer events. Hand-rolled backdrop-filter stack
      // (vs liquidglass-tailwind's `glass-nav`, which forces
      // `position: fixed; top: 0`).
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-md items-stretch justify-around gap-0.5 rounded-[26px] border border-border bg-background/80 px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-[24px] backdrop-saturate-[180%]">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          // Calendar tab gets a red-dot badge when there are open
          // catering inquiries the creator hasn't quoted yet.
          const showBadge = tab.label === "Calendar" && inquiryCount > 0;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-label={
                  showBadge
                    ? `${tab.label} (${inquiryCount} new inquir${inquiryCount === 1 ? "y" : "ies"})`
                    : tab.label
                }
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-all active:scale-95",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  <tab.icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                  {showBadge && (
                    <span
                      className="absolute right-1 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
                      aria-hidden="true"
                    >
                      {inquiryCount > 9 ? "9+" : inquiryCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
