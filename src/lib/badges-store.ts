import type { Badge, Streak } from "@/types";

interface BadgeContext {
  streak: Streak;
  totalOrders: number;
  vibeScore: number | null;
  leaderboardRank: number | null;
}

const BADGE_DEFINITIONS: Omit<Badge, "earnedAt">[] = [
  {
    id: "first_flame",
    name: "First Flame",
    description: "Maintain a 3-day selling streak",
    icon: "Flame",
    tier: "bronze",
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Maintain a 7-day selling streak",
    icon: "Zap",
    tier: "silver",
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Maintain a 30-day selling streak",
    icon: "Trophy",
    tier: "gold",
  },
  {
    id: "rising_star",
    name: "Rising Star",
    description: "Earn a 5-star vibe rating",
    icon: "Star",
    tier: "silver",
  },
  {
    id: "orders_10",
    name: "10 Plates Served",
    description: "Complete 10 orders",
    icon: "Package",
    tier: "bronze",
  },
  {
    id: "orders_50",
    name: "50 Plates Served",
    description: "Complete 50 orders",
    icon: "Package",
    tier: "silver",
  },
  {
    id: "orders_100",
    name: "Century Club",
    description: "Complete 100 orders",
    icon: "Package",
    tier: "gold",
  },
  {
    id: "top_10",
    name: "Top 10",
    description: "Reach the top 10 on the leaderboard",
    icon: "Gem",
    tier: "diamond",
  },
];

function checkEarned(badge: Omit<Badge, "earnedAt">, ctx: BadgeContext): boolean {
  switch (badge.id) {
    case "first_flame":
      return ctx.streak.longestStreak >= 3 || ctx.streak.currentStreak >= 3;
    case "week_warrior":
      return ctx.streak.longestStreak >= 7 || ctx.streak.currentStreak >= 7;
    case "streak_master":
      return ctx.streak.longestStreak >= 30 || ctx.streak.currentStreak >= 30;
    case "rising_star":
      return ctx.vibeScore !== null && ctx.vibeScore >= 5.0;
    case "orders_10":
      return ctx.totalOrders >= 10;
    case "orders_50":
      return ctx.totalOrders >= 50;
    case "orders_100":
      return ctx.totalOrders >= 100;
    case "top_10":
      return ctx.leaderboardRank !== null && ctx.leaderboardRank <= 10;
    default:
      return false;
  }
}

/**
 * Get all badges with their earned status.
 */
export function getBadges(ctx: BadgeContext): Badge[] {
  return BADGE_DEFINITIONS.map((def) => ({
    ...def,
    earnedAt: checkEarned(def, ctx) ? new Date().toISOString() : null,
  }));
}

/**
 * Get only earned badges.
 */
export function getEarnedBadges(ctx: BadgeContext): Badge[] {
  return getBadges(ctx).filter((b) => b.earnedAt !== null);
}

export const TIER_COLORS: Record<Badge["tier"], string> = {
  bronze: "from-amber-700/40 to-amber-900/40 border-amber-600/30",
  silver: "from-slate-400/30 to-slate-600/30 border-slate-400/30",
  gold: "from-yellow-500/30 to-yellow-700/30 border-yellow-500/30",
  diamond: "from-cyan-400/30 to-blue-600/30 border-cyan-400/30",
};
