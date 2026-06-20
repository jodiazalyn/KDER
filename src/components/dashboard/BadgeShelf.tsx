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
      <h2 className="mb-3 text-lg font-bold text-foreground">
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
              <Icon size={22} className="text-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                {badge.name}
              </span>
            </div>
          );
        })}

        {locked.slice(0, 3).map((badge) => (
          <div
            key={badge.id}
            // Locked badges use glass-card for the consistent tile
            // substrate; opacity-40 dims to indicate locked state.
            className="glass-card rounded-glass-lg flex-shrink-0 flex flex-col items-center gap-1.5 p-3 w-20 opacity-50"
          >
            <Lock size={22} className="text-muted-foreground/50" />
            <span className="text-[10px] font-medium text-muted-foreground/60 text-center leading-tight">
              {badge.name}
            </span>
          </div>
        ))}
      </div>

      {earned.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Complete orders and maintain streaks to earn badges!
        </p>
      )}
    </div>
  );
}
