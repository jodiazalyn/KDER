import { requireCreator } from "@/lib/loaders/auth";
import { loadCreatorListings } from "@/lib/loaders/listings";
import { loadCreatorOrders } from "@/lib/loaders/orders";
import { loadCreatorProfile } from "@/lib/loaders/profile";
import { getStreak } from "@/lib/streak-store";
import { getBadges } from "@/lib/badges-store";
import { DashboardClient } from "./dashboard-client";

// Dashboard is auth + creator scoped. Each visit is per-user, so
// we can't share a cached HTML payload across users; render
// dynamically per request. The data fetches now happen on the
// server in parallel — the response includes real content in
// the initial HTML so the user doesn't see a hydration-then-
// fetch waterfall.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user, creator } = await requireCreator();

  // Three independent queries — fire in parallel. The previous
  // client useEffect did the same Promise.all but each await
  // crossed a network boundary (browser → API → Supabase). Now
  // each await is server → Supabase only, which is roughly half
  // the round-trip cost AND happens before the user sees
  // anything (so the cost overlaps with HTML transit instead of
  // adding to it).
  const [profile, listingsRes, ordersRes] = await Promise.all([
    loadCreatorProfile(supabase, user.id),
    loadCreatorListings(supabase, creator.id, { activeOnly: true }),
    loadCreatorOrders(supabase, creator.id),
  ]);

  const allOrders = ordersRes.data;
  const completedOrders = allOrders.filter((o) => o.status === "completed");

  // RecentOrders shows the 5 most recent live orders (declined /
  // cancelled are noise on the dashboard — those have a dedicated
  // tab on /orders).
  const recentOrders = allOrders
    .filter((o) => o.status !== "declined" && o.status !== "cancelled")
    .slice(0, 5);

  const streak = getStreak(completedOrders);
  const badges = getBadges({
    streak,
    totalOrders: completedOrders.length,
    vibeScore: profile.vibe_score,
    leaderboardRank: null,
  });

  return (
    <DashboardClient
      profile={profile}
      activePlates={listingsRes.data}
      recentOrders={recentOrders}
      streak={streak}
      badges={badges}
    />
  );
}
