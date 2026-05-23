"use client";

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

  // Hide on fullscreen chat thread pages — matches Apple Messages / Instagram DMs pattern
  if (/^\/messages\/[^/]+/.test(pathname)) return null;

  return (
    <nav
      // Translucent saturated bottom-bar substrate. Hand-rolled
      // backdrop-filter stack (vs liquidglass-tailwind's `glass-nav`,
      // which forces `position: fixed; top: 0` and would relocate the
      // bar to the top of the viewport).
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.10] bg-[#0A0A0A]/80 backdrop-blur-[24px] backdrop-saturate-[180%] pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-all",
                  isActive
                    ? "text-green-300"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                <tab.icon size={22} strokeWidth={isActive ? 2.4 : 2} />
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
