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
      className="fixed right-3 top-1/2 z-50 -translate-y-1/2 flex flex-col gap-1 rounded-2xl border border-white/[0.12] bg-white/[0.10] px-1.5 py-2 backdrop-blur-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all",
              isActive
                ? "bg-green-900/50 text-green-400 shadow-[0_0_12px_rgba(74,222,128,0.2)]"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
            )}
          >
            <tab.icon size={20} />
            <span className="mt-0.5 text-[9px] font-medium leading-none">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
