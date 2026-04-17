"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, LayoutGrid, Bell, Wallet, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: Store, label: "Store" },
  { href: "/listings", icon: LayoutGrid, label: "Plates" },
  { href: "/orders", icon: Bell, label: "Orders" },
  { href: "/earnings", icon: Wallet, label: "Earn" },
  { href: "/messages", icon: MessageCircle, label: "Chat" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed right-3 top-1/2 z-50 -translate-y-1/2 flex flex-col gap-2"
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className="flex flex-col items-center gap-0.5"
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all",
                isActive
                  ? "bg-green-900/70 text-green-300 shadow-[0_0_16px_rgba(74,222,128,0.4)]"
                  : "bg-black/50 text-white/70 hover:bg-black/70"
              )}
            >
              <tab.icon size={20} />
            </span>
            <span
              className={cn(
                "text-[10px] font-medium leading-none",
                isActive ? "text-green-300" : "text-white/70"
              )}
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
