"use client";

import {
  Flame,
  Zap,
  Trophy,
  Star,
  Package,
  Gem,
  Lock,
} from "lucide-react";
import type { Badge } from "@/types";
import { TIER_COLORS } from "@/lib/badges-store";

const ICON_MAP: Record<string, typeof Flame> = {
  Flame,
  Zap,
  Trophy,
  Star,
  Package,
  Gem,
};

interface BadgeShelfProps {
  badges: Badge[];
}

export function BadgeShelf({ badges }: BadgeShelfProps) {
  const earned = badges.filter((b) => b.earnedAt);
  const locked = badges.filter((b) => !b.earnedAt);

  return (
    <div>
      <h2
        className="mb-3 text-lg font-bold text-green-300"
        style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
      >
        Badges
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {earned.map((badge) => {
          const Icon = ICON_MAP[badge.icon] || Star;
          return (
            <div
              key={badge.id}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border bg-gradient-to-b p-3 w-20 ${TIER_COLORS[badge.tier]}`}
            >
              <Icon size={22} className="text-white" />
              <span className="text-[10px] font-medium text-white/80 text-center leading-tight">
                {badge.name}
              </span>
            </div>
          );
        })}

        {locked.slice(0, 3).map((badge) => (
          <div
            key={badge.id}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 w-20 opacity-40"
          >
            <Lock size={22} className="text-white/30" />
            <span className="text-[10px] font-medium text-white/30 text-center leading-tight">
              {badge.name}
            </span>
          </div>
        ))}
      </div>

      {earned.length === 0 && (
        <p className="mt-1 text-xs text-white/30">
          Complete orders and maintain streaks to earn badges!
        </p>
      )}
    </div>
  );
}
