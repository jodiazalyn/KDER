import type { LeaderboardEntry } from "@/types";

/**
 * Demo leaderboard data. In production, this would be a Supabase query
 * with aggregations across creators, orders, and vibe_ratings.
 */
const DEMO_CREATORS: Omit<LeaderboardEntry, "rank" | "isCurrentUser">[] = [
  { creatorId: "c1", displayName: "Chef Marcus", handle: "chefmarcus", photoUrl: null, vibeScore: 4.9, totalOrders: 247, currentStreak: 14 },
  { creatorId: "c2", displayName: "Mama Rosa", handle: "mamarosa", photoUrl: null, vibeScore: 4.8, totalOrders: 198, currentStreak: 21 },
  { creatorId: "c3", displayName: "BBQ King", handle: "bbqking", photoUrl: null, vibeScore: 4.7, totalOrders: 312, currentStreak: 7 },
  { creatorId: "c4", displayName: "Sweet T", handle: "sweett", photoUrl: null, vibeScore: 4.9, totalOrders: 156, currentStreak: 3 },
  { creatorId: "c5", displayName: "Taco Loco", handle: "tacoloco", photoUrl: null, vibeScore: 4.6, totalOrders: 423, currentStreak: 30 },
  { creatorId: "c6", displayName: "Soul Sista", handle: "soulsista", photoUrl: null, vibeScore: 4.5, totalOrders: 89, currentStreak: 5 },
  { creatorId: "c7", displayName: "Gumbo God", handle: "gumbogod", photoUrl: null, vibeScore: 4.8, totalOrders: 176, currentStreak: 12 },
  { creatorId: "c8", displayName: "Vegan Vibes", handle: "veganvibes", photoUrl: null, vibeScore: 4.4, totalOrders: 67, currentStreak: 2 },
  { creatorId: "c9", displayName: "Plate Queen", handle: "platequeen", photoUrl: null, vibeScore: 4.7, totalOrders: 205, currentStreak: 9 },
  { creatorId: "c10", displayName: "H-Town Heat", handle: "htownheat", photoUrl: null, vibeScore: 4.3, totalOrders: 134, currentStreak: 0 },
];

export type LeaderboardSort = "vibeScore" | "totalOrders" | "currentStreak";

/**
 * Get the leaderboard sorted by the given criteria.
 * The current user is injected with isCurrentUser=true.
 */
export function getLeaderboard(
  sortBy: LeaderboardSort = "vibeScore",
  currentUserData?: {
    displayName: string;
    handle: string;
    photoUrl: string | null;
    vibeScore: number;
    totalOrders: number;
    currentStreak: number;
  }
): LeaderboardEntry[] {
  const entries = [...DEMO_CREATORS];

  // Inject current user if provided
  if (currentUserData) {
    const existing = entries.findIndex(
      (e) => e.handle === currentUserData.handle
    );
    if (existing >= 0) {
      entries[existing] = { ...entries[existing], ...currentUserData, creatorId: "current" };
    } else {
      entries.push({
        creatorId: "current",
        ...currentUserData,
      });
    }
  }

  // Sort
  entries.sort((a, b) => {
    switch (sortBy) {
      case "vibeScore":
        return b.vibeScore - a.vibeScore;
      case "totalOrders":
        return b.totalOrders - a.totalOrders;
      case "currentStreak":
        return b.currentStreak - a.currentStreak;
      default:
        return 0;
    }
  });

  // Assign ranks
  return entries.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    isCurrentUser: entry.creatorId === "current",
  }));
}
