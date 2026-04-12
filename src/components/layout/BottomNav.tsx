"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, LayoutGrid, Bell, Wallet, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: Store, label: "My Store" },
  { href: "/listings", icon: LayoutGrid, label: "Plates" },
  { href: "/orders", icon: Bell, label: "Orders" },
  { href: "/earnings", icon: Wallet, label: "Earnings" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const scrollDir = useScrollDirection();

  return (
    <motion.nav
      animate={{ height: scrollDir === "down" ? 48 : 64 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-white/[0.18] backdrop-blur-[40px]"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-[48px] flex-col items-center justify-center gap-0.5 px-3",
                isActive ? "text-green-400" : "text-white/50"
              )}
            >
              <tab.icon size={20} />
              <motion.span
                animate={{ opacity: scrollDir === "down" ? 0 : 1 }}
                className="text-xs"
              >
                {tab.label}
              </motion.span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
