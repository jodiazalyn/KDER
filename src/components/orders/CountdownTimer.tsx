"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  autoDeclineAt: string;
  className?: string;
}

export function CountdownTimer({
  autoDeclineAt,
  className,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(
      0,
      Math.floor(
        (new Date(autoDeclineAt).getTime() - Date.now()) / 1000
      )
    )
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(autoDeclineAt).getTime() - Date.now()) / 1000
        )
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [autoDeclineAt]);

  if (secondsLeft <= 0) {
    return (
      <span className={cn("text-xs font-medium text-red-400", className)}>
        Expired
      </span>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft < 300; // < 5 minutes

  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        isUrgent ? "text-red-400 animate-pulse" : "text-orange-300",
        className
      )}
      aria-label={`Auto-decline in ${minutes} minutes ${seconds} seconds`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
