"use client";

import { useState } from "react";
import Link from "next/link";
import { Pause, Play, Mail } from "lucide-react";
import { StorefrontHeader } from "@/components/dashboard/StorefrontHeader";
import { ShareLinkCard } from "@/components/dashboard/ShareLinkCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { ActivePlatesPreview } from "@/components/dashboard/ActivePlatesPreview";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { setStorefrontActive } from "@/lib/creator-store";
import { StreakBanner } from "@/components/dashboard/StreakBanner";
import { BadgeShelf } from "@/components/dashboard/BadgeShelf";
import type { CreatorProfile } from "@/lib/creator-store";
import type { Listing, Order, Streak, Badge } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Dashboard client island.
 *
 * All the interactive bits — storefront toggle, photo upload,
 * email-banner dismissal — live here. Data is hydrated from the
 * server (see `page.tsx`) so this island renders content
 * instantly without a useEffect fetch waterfall.
 */
interface Props {
  profile: CreatorProfile;
  activePlates: Listing[];
  recentOrders: Order[];
  streak: Streak;
  badges: Badge[];
}

export function DashboardClient({
  profile: initialProfile,
  activePlates,
  recentOrders,
  streak,
  badges,
}: Props) {
  // Local state for profile so toggling storefront flips the
  // pill instantly + photo uploads update without a full reload.
  // Re-seeded only on full navigation (router.refresh / new mount).
  const [profile, setProfile] = useState<CreatorProfile>(initialProfile);

  const heroImage =
    activePlates.length > 0 && activePlates[0].photos.length > 0
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
    <main className="min-h-screen bg-background">
      {/* Storefront Header Hero */}
      <StorefrontHeader
        profile={profile}
        heroImage={heroImage}
        onPhotoChange={(url) => setProfile({ ...profile, photo_url: url })}
      />

      {/* Content */}
      <div className="space-y-5 px-4 pb-8 pt-4">
        {/* Missing-email backfill nudge — legacy creators who onboarded
            before the email-collection migration won't receive new-order
            alerts until they add one. Surfaces persistently (no dismiss)
            because the cost of missing an order is high. */}
        {!profile.email && (
          <Link
            href="/settings"
            className="flex w-full items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200 active:scale-[0.99] transition-transform"
          >
            <Mail size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold">Add your email so you don&apos;t miss orders</p>
              <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-200/70">
                We send new-order alerts to your email — tap to add one in Settings.
              </p>
            </div>
          </Link>
        )}

        {/* Storefront status */}
        <button
          type="button"
          onClick={toggleStorefront}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]",
            profile.storefront_active
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          )}
        >
          <span className="flex items-center gap-2">
            {profile.storefront_active ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Your storefront is live
              </>
            ) : (
              <>
                <Pause size={14} />
                Your storefront is paused
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
          activePlates={activePlates.length}
          pendingOrders={0}
          weekEarnings={0}
        />

        {/* Active plates preview */}
        <ActivePlatesPreview plates={activePlates} />

        {/* Recent orders */}
        <RecentOrders handle={profile.handle} orders={recentOrders} />
      </div>
    </main>
  );
}
