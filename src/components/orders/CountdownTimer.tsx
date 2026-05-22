"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  /** When the order was created. We render the elapsed time since then. */
  createdAt: string;
  className?: string;
}

/**
 * Elapsed-time pill for pending orders. Replaces the previous
 * countdown-to-auto-decline behavior — orders no longer auto-decline,
 * so the urgency signal is now "how long has the customer been waiting"
 * rather than "how long until this expires."
 */
export function CountdownTimer({ createdAt, className }: CountdownTimerProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed(
        Math.max(
          0,
          Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const minutes = Math.floor(secondsElapsed / 60);
  const hours = Math.floor(minutes / 60);

  // Visual urgency thresholds:
  //   <15 min  → orange (fresh)
  //   ≥15 min  → red    (escalation reminders are firing now)
  const isUrgent = minutes >= 15;

  // Compact label: "3m", "47m", "2h", "2h 15m"
  let label: string;
  if (hours >= 1) {
    const remMin = minutes % 60;
    label = remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  } else {
    label = `${minutes}m`;
  }

  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        isUrgent ? "text-red-400" : "text-orange-300",
        className
      )}
      aria-label={`Waiting ${label}`}
    >
      Waiting {label}
    </span>
  );
}
