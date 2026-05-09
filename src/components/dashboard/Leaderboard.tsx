"use client";

import { useState } from "react";
import { Crown, Star, ShoppingBag, Flame, ExternalLink } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { getLeaderboard, type LeaderboardSort } from "@/lib/leaderboard-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface LeaderboardPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: {
    displayName: string;
    handle: string;
    photoUrl: string | null;
    vibeScore: number;
    totalOrders: number;
    currentStreak: number;
  };
  anonymous?: boolean;
}

export function LeaderboardPanel({
  open,
  onOpenChange,
  currentUser,
  anonymous = false,
}: LeaderboardPanelProps) {
  const [sortBy, setSortBy] = useState<LeaderboardSort>("vibeScore");
  const entries = getLeaderboard(sortBy, currentUser);

  // Calculate user ranks across all categories
  const userRanks = currentUser
    ? {
        vibe: getLeaderboard("vibeScore", currentUser).find((e) => e.isCurrentUser)?.rank ?? null,
        orders: getLeaderboard("totalOrders", currentUser).find((e) => e.isCurrentUser)?.rank ?? null,
        streak: getLeaderboard("currentStreak", currentUser).find((e) => e.isCurrentUser)?.rank ?? null,
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Sheet primitive already applies `glass-modal` (Phase 2);
        // we only override sizing/text/scroll here.
        className="w-full max-w-sm text-white p-0 overflow-y-auto"
      >
        <SheetHeader className="px-5 pt-6 pb-3">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Crown size={20} className="text-yellow-400" />
            Leaderboard
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-8 space-y-5">
          {/* Your Rankings — all 3 categories. glass-card with KDER
              green tint to highlight as "your" section. */}
          {!anonymous && userRanks && (
            <div className="glass-card rounded-glass-lg border-emerald-400/25 bg-emerald-500/10 p-4">
              <p className="text-xs font-medium text-green-300/60 uppercase tracking-wider mb-3">
                Your Rankings
              </p>
              <div className="grid grid-cols-3 gap-3">
                <RankCard
                  label="Vibe"
                  rank={userRanks.vibe}
                  icon={<Star size={14} className="text-yellow-400" />}
                />
                <RankCard
                  label="Orders"
                  rank={userRanks.orders}
                  icon={<ShoppingBag size={14} className="text-green-300" />}
                />
                <RankCard
                  label="Streak"
                  rank={userRanks.streak}
                  icon={<Flame size={14} className="text-orange-400" />}
                />
              </div>
            </div>
          )}

          {/* Sort tabs — glass-segment is the iOS-style segmented
              control from liquidglass-tailwind. */}
          <div className="glass-segment flex gap-1 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortBy(tab.key)}
                className={cn(
                  "glass-segment-item flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium",
                  sortBy === tab.key
                    ? "glass-segment-item-active text-white"
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
              <LeaderboardRow
                key={entry.creatorId}
                entry={entry}
                sortBy={sortBy}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RankCard({
  label,
  rank,
  icon,
}: {
  label: string;
  rank: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-glass flex flex-col items-center gap-1 p-3">
      {icon}
      <span className="text-xl font-black text-white">
        #{rank ?? "—"}
      </span>
      <span className="text-[10px] text-white/40">{label}</span>
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

  const handleClick = () => {
    if (!entry.isCurrentUser) {
      window.open(`/@${entry.handle}`, "_blank");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={entry.isCurrentUser}
      className={cn(
        "glass-card rounded-glass flex w-full items-center gap-3 p-2.5 transition-all text-left",
        entry.isCurrentUser
          ? "border-emerald-400/25 bg-emerald-500/15 cursor-default"
          : "hover:bg-white/[0.18] cursor-pointer active:scale-[0.98]"
      )}
    >
      {/* Rank */}
      <span className={cn("w-6 text-center text-sm font-black", rankColor)}>
        {entry.rank}
      </span>

      {/* Avatar */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white/60 flex-shrink-0">
        {entry.displayName.charAt(0)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            entry.isCurrentUser ? "text-green-300" : "text-white"
          )}
        >
          {entry.displayName}
          {entry.isCurrentUser && (
            <span className="ml-1 text-[10px] text-green-300/60">(You)</span>
          )}
        </p>
        <p className="text-[10px] text-white/30">@{entry.handle}</p>
      </div>

      {/* Value */}
      <span className="text-sm font-bold text-green-300">{value}</span>

      {/* External link indicator */}
      {!entry.isCurrentUser && (
        <ExternalLink size={12} className="text-white/20 flex-shrink-0" />
      )}
    </button>
  );
}
