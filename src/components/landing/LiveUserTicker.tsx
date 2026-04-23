"use client";

import { useEffect, useState } from "react";

/**
 * Live user ticker — visible social-proof counter on the landing page.
 *
 * Seeds at 3,000,000 "Americans looking for home-cooked meals right now"
 * and grows linearly to the full US population over a 9-month ramp.
 * Every second it recomputes against wall-clock time, so a visitor who
 * lands after the launch date sees a higher number than a visitor on
 * day one, and the number ticks up in realtime while they watch.
 *
 * The growth curve is deterministic — it's derived from (current time -
 * LAUNCH) — so two browsers open at the same moment see the same number.
 * No backend involvement, no API cost; this is a pure client-side
 * projection that hits a hard cap once the 9-month window closes.
 */

// Launch anchor. Every visitor's ticker is computed relative to this
// timestamp. Bumping it resets the ticker to its seed value for everyone.
const LAUNCH_MS = new Date("2026-04-23T00:00:00Z").getTime();

const SEED_USERS = 3_000_000;

// US population estimate. 335M is roughly the 2024 Census figure; feel
// free to refresh when the next Census lands or when product scope
// widens beyond the US.
const US_POPULATION = 335_000_000;

// 9 months in milliseconds (using 30-day months for math simplicity).
const RAMP_DURATION_MS = 9 * 30 * 24 * 60 * 60 * 1000;

function computeUsers(nowMs: number): number {
  const elapsed = Math.max(0, nowMs - LAUNCH_MS);
  const progress = Math.min(1, elapsed / RAMP_DURATION_MS);
  return Math.floor(SEED_USERS + progress * (US_POPULATION - SEED_USERS));
}

const formatter = new Intl.NumberFormat("en-US");

export function LiveUserTicker() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // Defer the initial setState via setTimeout(0) to satisfy React 19's
    // react-hooks/set-state-in-effect rule. Subsequent ticks happen inside
    // the interval callback, which is outside the effect body.
    const initial = setTimeout(() => setCount(computeUsers(Date.now())), 0);
    const id = setInterval(() => setCount(computeUsers(Date.now())), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  // Don't render anything on the server side — avoids hydration mismatch
  // when the server-rendered count would inevitably differ from the
  // client-computed count on the very next frame.
  if (count === null) return null;

  return (
    <div
      className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-green-400/25 bg-green-900/20 px-4 py-2 text-xs text-white/75 backdrop-blur-sm"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"
          style={{
            animation: "kder-ticker-pulse 1.6s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-300" />
      </span>
      <span>
        <strong
          className="text-sm font-bold text-white tabular-nums"
          style={{ filter: "drop-shadow(0 1px 4px rgba(46,125,50,0.4))" }}
        >
          {formatter.format(count)}
        </strong>{" "}
        <span className="text-white/60">
          Americans looking for home-cooked meals right now
        </span>
      </span>
      {/* Inlined keyframes so the component is self-contained and doesn't
          depend on tailwind's animate-ping (which is too fast for this). */}
      <style>{`
        @keyframes kder-ticker-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
