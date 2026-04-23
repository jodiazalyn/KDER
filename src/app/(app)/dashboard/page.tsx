"use client";

import { useState, useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { StorefrontHeader } from "@/components/dashboard/StorefrontHeader";
import { ShareLinkCard } from "@/components/dashboard/ShareLinkCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { ActivePlatesPreview } from "@/components/dashboard/ActivePlatesPreview";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { getCreatorProfileAsync, setStorefrontActive } from "@/lib/creator-store";
import { getStreak } from "@/lib/streak-store";
import { getBadges } from "@/lib/badges-store";
import { getOrders } from "@/lib/orders-store";
import { StreakBanner } from "@/components/dashboard/StreakBanner";
import { BadgeShelf } from "@/components/dashboard/BadgeShelf";
import { LiveUserTicker } from "@/components/landing/LiveUserTicker";
// Leaderboard moved to floating button in layout
import type { CreatorProfile } from "@/lib/creator-store";
import type { Listing, Streak, Badge } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function DashboardPage() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [activePlates, setActivePlates] = useState<Listing[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [streak, setStreak] = useState<Streak>({ currentStreak: 0, longestStreak: 0, lastOrderDate: null, isActive: false });
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const p = await getCreatorProfileAsync();
      if (cancelled) return;
      setProfile(p);

      // Fetch active plates from Supabase for the authenticated creator
      try {
        const res = await fetch("/api/v1/listings?mine=true&status=active");
        const json = await res.json();
        if (!cancelled && res.ok) {
          const plates = (json.data?.listings ?? []) as Listing[];
          setActivePlates(plates);
          setActiveCount(plates.length);
        }
      } catch {
        // Non-fatal — dashboard still renders
      }

      const s = getStreak();
      setStreak(s);

      const completedOrders = getOrders().filter((o) => o.status === "completed").length;
      const b = getBadges({
        streak: s,
        totalOrders: completedOrders,
        vibeScore: p.vibe_score,
        leaderboardRank: null,
      });
      setBadges(b);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
      </main>
    );
  }

  const heroImage = activePlates.length > 0 && activePlates[0].photos.length > 0
    ? activePlates[0].photos[0]
    : null;

  const toggleStorefront = () => {
    const newState = !profile.storefront_active;
    setStorefrontActive(newState);
    setProfile({ ...profile, storefront_active: newState });
    toast.success(
      newState ? "Your storefront is live!" : "Your storefront is paused."
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0A0A] via-[#0D1A0D] to-[#0A0A0A]">
      {/* Storefront Header Hero */}
      <StorefrontHeader
        profile={profile}
        heroImage={heroImage}
        onPhotoChange={(dataUrl) => {
          // Persist to sessionStorage so it survives page navigations
          const raw = sessionStorage.getItem("kder_onboarding_profile");
          const data = raw ? JSON.parse(raw) : {};
          data.photo_url = dataUrl;
          sessionStorage.setItem("kder_onboarding_profile", JSON.stringify(data));
          setProfile({ ...profile, photo_url: dataUrl });
        }}
      />

      {/* Content */}
      <div className="space-y-5 px-4 pb-8 pt-4">
        {/* Live demand counter — keeps creators visually aware that the
            market is growing every time they open their dashboard. */}
        <div className="flex justify-center">
          <LiveUserTicker />
        </div>

        {/* Storefront status */}
        <button
          type="button"
          onClick={toggleStorefront}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]",
            profile.storefront_active
              ? "border-green-400/20 bg-green-900/20 text-green-300"
              : "border-orange-400/20 bg-orange-900/20 text-orange-300"
          )}
        >
          <span className="flex items-center gap-2">
            {profile.storefront_active ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Your storefront is live
              </>
            ) : (
              <>
                <Pause size={14} />
                Your storefront is paused
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-white/40">
            {profile.storefront_active ? (
              <>
                <Pause size={12} /> Pause
              </>
            ) : (
              <>
                <Play size={12} /> Resume
              </>
            )}
          </span>
        </button>

        {/* Share your link */}
        <ShareLinkCard handle={profile.handle} />

        {/* Streak Banner */}
        <StreakBanner streak={streak} />

        {/* Badges */}
        <BadgeShelf badges={badges} />

        {/* Quick stats */}
        <QuickStats
          activePlates={activeCount}
          pendingOrders={0}
          weekEarnings={0}
        />

        {/* Active plates preview */}
        <ActivePlatesPreview plates={activePlates} />

        {/* Recent orders */}
        <RecentOrders handle={profile.handle} />
      </div>
    </main>
  );
}
