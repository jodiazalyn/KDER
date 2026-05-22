"use client";

import Link from "next/link";
import { UtensilsCrossed, Bell, DollarSign } from "lucide-react";

interface QuickStatsProps {
  activePlates: number;
  pendingOrders: number;
  weekEarnings: number;
}

export function QuickStats({
  activePlates,
  pendingOrders,
  weekEarnings,
}: QuickStatsProps) {
  const stats = [
    {
      icon: UtensilsCrossed,
      value: activePlates,
      label: "Active Plates",
      href: "/listings",
    },
    {
      icon: Bell,
      value: pendingOrders,
      label: "Pending Orders",
      href: "/orders",
    },
    {
      icon: DollarSign,
      value: `$${weekEarnings.toFixed(0)}`,
      label: "This Week",
      href: "/earnings",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          // glass-card for each tile — the standard in-app card
          // surface. Hover/active states preserved.
          className="glass-card rounded-glass-lg flex flex-col items-center gap-1.5 p-3 hover:bg-white/[0.18] active:scale-95 transition-transform"
        >
          <stat.icon size={18} className="text-green-400" />
          <span className="text-xl font-bold text-white">{stat.value}</span>
          <span className="text-[10px] text-white/50 text-center leading-tight">
            {stat.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
