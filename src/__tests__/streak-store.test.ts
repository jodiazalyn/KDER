import { describe, it, expect, beforeEach } from "vitest";
import { getStreak } from "@/lib/streak-store";

describe("Streak Calculation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns zero streak when no orders", () => {
    const streak = getStreak();
    expect(streak.currentStreak).toBe(0);
    expect(streak.longestStreak).toBe(0);
    expect(streak.isActive).toBe(false);
    expect(streak.lastOrderDate).toBeNull();
  });
});
