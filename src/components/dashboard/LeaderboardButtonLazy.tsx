"use client";

import dynamic from "next/dynamic";

// Defer the entire LeaderboardButton (including the panel it opens) to a
// client-only async chunk. The crown is purely interactive UI — there's no
// SEO or first-paint reason to render it server-side, and the saved
// ~300-500KB of first-load JS is felt on every authenticated route.
//
// Lives in its own client component so the `(app)/layout.tsx` can stay a
// Server Component (Next 15 forbids `ssr: false` from server scope).
const LeaderboardButton = dynamic(
  () =>
    import("./LeaderboardButton").then((m) => m.LeaderboardButton),
  { ssr: false }
);

export function LeaderboardButtonLazy() {
  return <LeaderboardButton />;
}
