import { describe, it, expect } from "vitest";
import { getBadges, getEarnedBadges } from "@/lib/badges-store";
import type { Streak } from "@/types";

const noStreak: Streak = { currentStreak: 0, longestStreak: 0, lastOrderDate: null, isActive: false };

describe("Badges Store", () => {
  it("returns all badge definitions", () => {
    const badges = getBadges({
      streak: noStreak,
      totalOrders: 0,
      vibeScore: null,
      leaderboardRank: null,
    });
    expect(badges.length).toBe(8);
    expect(badges.every((b) => b.earnedAt === null)).toBe(true);
  });

  it("earns First Flame at 3-day streak", () => {
    const badges = getEarnedBadges({
      streak: { currentStreak: 3, longestStreak: 3, lastOrderDate: null, isActive: true },
      totalOrders: 5,
      vibeScore: null,
      leaderboardRank: null,
    });
    expect(badges.some((b) => b.id === "first_flame")).toBe(true);
  });

  it("earns Week Warrior at 7-day streak", () => {
    const badges = getEarnedBadges({
      streak: { currentStreak: 7, longestStreak: 7, lastOrderDate: null, isActive: true },
      totalOrders: 10,
      vibeScore: null,
      leaderboardRank: null,
    });
    expect(badges.some((b) => b.id === "week_warrior")).toBe(true);
  });

  it("earns Rising Star at 5.0 vibe score", () => {
    const badges = getEarnedBadges({
      streak: noStreak,
      totalOrders: 5,
      vibeScore: 5.0,
      leaderboardRank: null,
    });
    expect(badges.some((b) => b.id === "rising_star")).toBe(true);
  });

  it("earns 10 Orders badge", () => {
    const badges = getEarnedBadges({
      streak: noStreak,
      totalOrders: 10,
      vibeScore: null,
      leaderboardRank: null,
    });
    expect(badges.some((b) => b.id === "orders_10")).toBe(true);
  });

  it("earns Top 10 badge", () => {
    const badges = getEarnedBadges({
      streak: noStreak,
      totalOrders: 0,
      vibeScore: null,
      leaderboardRank: 5,
    });
    expect(badges.some((b) => b.id === "top_10")).toBe(true);
  });

  it("does NOT earn Top 10 at rank 11", () => {
    const badges = getEarnedBadges({
      streak: noStreak,
      totalOrders: 0,
      vibeScore: null,
      leaderboardRank: 11,
    });
    expect(badges.some((b) => b.id === "top_10")).toBe(false);
  });

  it("earns multiple badges at once", () => {
    const badges = getEarnedBadges({
      streak: { currentStreak: 7, longestStreak: 7, lastOrderDate: null, isActive: true },
      totalOrders: 50,
      vibeScore: 5.0,
      leaderboardRank: 3,
    });
    expect(badges.length).toBeGreaterThanOrEqual(5);
    expect(badges.some((b) => b.id === "first_flame")).toBe(true);
    expect(badges.some((b) => b.id === "week_warrior")).toBe(true);
    expect(badges.some((b) => b.id === "rising_star")).toBe(true);
    expect(badges.some((b) => b.id === "orders_50")).toBe(true);
    expect(badges.some((b) => b.id === "top_10")).toBe(true);
  });
});
