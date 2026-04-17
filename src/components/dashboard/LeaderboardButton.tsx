"use client";

import { useState, useEffect } from "react";
import { Crown } from "lucide-react";
import { LeaderboardPanel } from "./Leaderboard";
import { getStreak } from "@/lib/streak-store";
import { getOrders } from "@/lib/orders-store";
import { getCreatorProfileAsync } from "@/lib/creator-store";
import { getLeaderboard } from "@/lib/leaderboard-store";

interface LeaderboardButtonProps {
  /** If true, hide "Your Rankings" section (for anonymous/member views) */
  anonymous?: boolean;
}

export function LeaderboardButton({ anonymous = false }: LeaderboardButtonProps) {
  const [open, setOpen] = useState(false);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [userData, setUserData] = useState<{
    displayName: string;
    handle: string;
    photoUrl: string | null;
    vibeScore: number;
    totalOrders: number;
    currentStreak: number;
  } | undefined>(undefined);

  useEffect(() => {
    if (anonymous) return;

    let cancelled = false;
    async function load() {
      const profile = await getCreatorProfileAsync();
      if (cancelled) return;

      const streak = getStreak();
      const completedOrders = getOrders().filter((o) => o.status === "completed").length;

      const user = {
        displayName: profile.display_name,
        handle: profile.handle,
        photoUrl: profile.photo_url,
        vibeScore: profile.vibe_score || 0,
        totalOrders: completedOrders,
        currentStreak: streak.currentStreak,
      };
      setUserData(user);

      // Calculate best rank across all categories
      const vibeRank = getLeaderboard("vibeScore", user).find((e) => e.isCurrentUser)?.rank ?? 99;
      const orderRank = getLeaderboard("totalOrders", user).find((e) => e.isCurrentUser)?.rank ?? 99;
      const streakRank = getLeaderboard("currentStreak", user).find((e) => e.isCurrentUser)?.rank ?? 99;
      setBestRank(Math.min(vibeRank, orderRank, streakRank));
    }
    load();
    return () => { cancelled = true; };
  }, [anonymous]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open leaderboard"
        className="fixed top-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-400/20 bg-[#0A0A0A]/80 backdrop-blur-[40px] shadow-[0_0_16px_rgba(234,179,8,0.15)] transition-all hover:border-yellow-400/40 active:scale-90"
      >
        <Crown size={18} className="text-yellow-400" />
        {bestRank !== null && bestRank <= 10 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-black">
            {bestRank}
          </span>
        )}
      </button>

      <LeaderboardPanel
        open={open}
        onOpenChange={setOpen}
        currentUser={userData}
        anonymous={anonymous}
      />
    </>
  );
}
