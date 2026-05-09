"use client";

import { Flame } from "lucide-react";
import type { Streak } from "@/types";

interface StreakBannerProps {
  streak: Streak;
}

export function StreakBanner({ streak }: StreakBannerProps) {
  if (streak.currentStreak === 0 && streak.longestStreak === 0) {
    return (
      <div className="glass-card rounded-glass-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
            <Flame size={20} className="text-white/20" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/50">No streak yet</p>
            <p className="text-xs text-white/30">
              Complete an order to start your streak!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    // glass-card-elevated + glass-shine for the active-streak hero
    // treatment. Orange/red gradient kept as the brand-feel tint
    // overlay (overrides glass-card-elevated's default bg).
    <div className="glass-card-elevated glass-shine rounded-glass-lg border-orange-500/30 bg-gradient-to-r from-orange-900/40 to-red-900/30 p-4 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20"
            style={{
              animation: streak.isActive
                ? "pulse 2s ease-in-out infinite"
                : "none",
            }}
          >
            <Flame
              size={24}
              className={streak.isActive ? "text-orange-400" : "text-orange-400/50"}
            />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-orange-300">
                {streak.currentStreak}
              </span>
              <span className="text-sm font-medium text-orange-300/70">
                day{streak.currentStreak !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-white/40">
              {streak.isActive ? "Streak is active!" : "Keep selling to maintain your streak"}
            </p>
          </div>
        </div>

        {streak.longestStreak > streak.currentStreak && (
          <div className="text-right">
            <p className="text-xs text-white/30">Best</p>
            <p className="text-sm font-bold text-white/50">
              {streak.longestStreak}d
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
