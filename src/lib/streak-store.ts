import { getOrders } from "./orders-store";
import type { Streak } from "@/types";

/**
 * Calculate the creator's current selling streak from completed orders.
 * A streak = consecutive calendar days with at least 1 completed order.
 */
export function getStreak(): Streak {
  const orders = getOrders();
  const completed = orders.filter((o) => o.status === "completed");

  if (completed.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastOrderDate: null, isActive: false };
  }

  // Get unique dates (YYYY-MM-DD) with completed orders, sorted descending
  const dates = [
    ...new Set(
      completed.map((o) => new Date(o.created_at).toISOString().split("T")[0])
    ),
  ].sort((a, b) => b.localeCompare(a));

  const lastOrderDate = dates[0];

  // Check if streak is still active (last order was today or yesterday)
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const isActive = lastOrderDate === today || lastOrderDate === yesterday;

  // Calculate current streak (consecutive days from most recent)
  let currentStreak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const curr = new Date(dates[i]);
    const prev = new Date(dates[i + 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  // If streak is broken (no order today or yesterday), reset to 0
  if (!isActive) {
    currentStreak = 0;
  }

  // Calculate longest streak ever
  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const curr = new Date(dates[i]);
    const prev = new Date(dates[i + 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { currentStreak, longestStreak, lastOrderDate, isActive };
}
