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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-[24px] pb-[env(safe-area-inset-bottom)]"
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
