"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Crown } from "lucide-react";
import { getStreak } from "@/lib/streak-store";
import { getOrders } from "@/lib/orders-store";
import { getCreatorProfileAsync } from "@/lib/creator-store";
import { getLeaderboard } from "@/lib/leaderboard-store";

// Defer the panel itself — only loads when the crown is tapped.
const LeaderboardPanel = dynamic(
  () => import("./Leaderboard").then((m) => m.LeaderboardPanel),
  { ssr: false }
);

interface LeaderboardButtonProps {
  /** If true, hide "Your Rankings" section (for anonymous/member views) */
  anonymous?: boolean;
}

export function LeaderboardButton({ anonymous = false }: LeaderboardButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Track first-open so we can keep the panel mounted across re-closes
  // (avoids re-fetching the dynamic chunk every time the user toggles).
  const [hasOpened, setHasOpened] = useState(false);
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

  // Hide on messages and plates (listings) surfaces — crown overlaps their top-right UI
  if (/^\/messages(\/|$)/.test(pathname)) return null;
  if (/^\/listings(\/|$)/.test(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setHasOpened(true);
        }}
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

      {/* Only mount the panel after the user has opened it once, so the
          dynamic import doesn't fire on initial render and the chunk
          actually stays out of the critical path. After first open we
          keep it mounted so reopen is instant. */}
      {hasOpened ? (
        <LeaderboardPanel
          open={open}
          onOpenChange={setOpen}
          currentUser={userData}
          anonymous={anonymous}
        />
      ) : null}
    </>
  );
}
