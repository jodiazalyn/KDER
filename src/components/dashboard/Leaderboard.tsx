"use client";

import { useState } from "react";
import { Crown, Star, ShoppingBag, Flame } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { getLeaderboard, type LeaderboardSort } from "@/lib/leaderboard-store";
import { cn } from "@/lib/utils";

const TABS: { key: LeaderboardSort; label: string; icon: typeof Star }[] = [
  { key: "vibeScore", label: "Vibe", icon: Star },
  { key: "totalOrders", label: "Orders", icon: ShoppingBag },
  { key: "currentStreak", label: "Streak", icon: Flame },
];

const RANK_COLORS: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-600",
};

interface LeaderboardProps {
  currentUser?: {
    displayName: string;
    handle: string;
    photoUrl: string | null;
    vibeScore: number;
    totalOrders: number;
    currentStreak: number;
  };
}

export function Leaderboard({ currentUser }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<LeaderboardSort>("vibeScore");
  const entries = getLeaderboard(sortBy, currentUser);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
        >
          Leaderboard
        </h2>
        <Crown size={16} className="text-yellow-400/60" />
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-all",
              sortBy === tab.key
                ? "bg-white/[0.12] text-white"
                : "text-white/40 hover:text-white/60"
            )}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-1.5">
        {entries.slice(0, 10).map((entry) => (
          <LeaderboardRow key={entry.creatorId} entry={entry} sortBy={sortBy} />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  sortBy,
}: {
  entry: LeaderboardEntry;
  sortBy: LeaderboardSort;
}) {
  const rankColor = RANK_COLORS[entry.rank] || "text-white/40";
  const value =
    sortBy === "vibeScore"
      ? entry.vibeScore.toFixed(1)
      : sortBy === "totalOrders"
        ? String(entry.totalOrders)
        : `${entry.currentStreak}d`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl p-2.5 transition-all",
        entry.isCurrentUser
          ? "border border-green-400/20 bg-green-900/20"
          : "border border-white/[0.06] bg-white/[0.03]"
      )}
    >
      {/* Rank */}
      <span className={cn("w-6 text-center text-sm font-black", rankColor)}>
        {entry.rank <= 3 ? ["", "1", "2", "3"][entry.rank] : entry.rank}
      </span>

      {/* Avatar */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white/60">
        {entry.displayName.charAt(0)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold truncate",
          entry.isCurrentUser ? "text-green-300" : "text-white"
        )}>
          {entry.displayName}
          {entry.isCurrentUser && (
            <span className="ml-1 text-[10px] text-green-300/60">(You)</span>
          )}
        </p>
        <p className="text-[10px] text-white/30">@{entry.handle}</p>
      </div>

      {/* Value */}
      <span className="text-sm font-bold text-green-300">{value}</span>
    </div>
  );
}
