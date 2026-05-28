"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { usePricingCoach } from "./PricingCoachProvider";

/**
 * Floating launcher for the Pricing Coach.
 *
 * Pinned bottom-right, just above the BottomNav. Tapping opens the
 * agent in a sheet sourced from PricingCoachProvider. Persists across
 * pages within the authed app shell.
 *
 * Hidden when:
 *  - the user is already on /pricing-agent (avoid double surface)
 *  - the agent sheet is currently open (avoid floating over itself)
 *  - the user is in a fullscreen messages thread (matches BottomNav's
 *    own hide rule — those screens are meant to feel modal)
 */
export function PricingCoachLauncher() {
  const { open, isOnAgentPage, isOpen } = usePricingCoach();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Stagger the entrance so the launcher isn't fighting the page's own
  // mount animation for attention. Also avoids a flash on routes where
  // the visibility rules will hide it.
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 250);
    return () => clearTimeout(id);
  }, []);

  // Hide in fullscreen DMs (same convention BottomNav uses).
  const inMessageThread = /^\/messages\/[^/]+/.test(pathname ?? "");

  // Hide on catering inquiry + booking detail pages — those surfaces
  // have a sticky bottom action bar with the primary CTAs (Message /
  // Build quote / Accept / Cancel). The FAB sits in the same right-
  // edge zone and was overlapping the green primary button, plus
  // tempting the creator away from the moment-critical action.
  const onCateringDetail = /^\/catering\/(inquiries|bookings)\/[^/]+/.test(
    pathname ?? ""
  );

  if (isOnAgentPage || isOpen || inMessageThread || onCateringDetail) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label="Open Mia, your KDER concierge"
      title="Chat with Mia"
      // Position: above the bottom nav (5rem) + safe-area + a touch of
      // breathing room (1rem). Right edge mirrors the leaderboard crown
      // pattern so they don't compete for the same screen quadrant —
      // the crown lives top-right, the coach sits bottom-right.
      className={[
        "group fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full",
        "bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)]",
        // Brand green with a subtle outer glow so the FAB reads as
        // "interactive surface" against any underlying page.
        "bg-gradient-to-br from-[#2E7D32] to-[#1B5E20]",
        "shadow-[0_8px_24px_rgba(27,94,32,0.45),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
        "transition-all duration-200 ease-out",
        "hover:scale-105 hover:shadow-[0_12px_28px_rgba(27,94,32,0.55),0_0_0_1px_rgba(255,255,255,0.12)_inset]",
        "active:scale-95",
        mounted
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      {/* KDER brand mark inside the FAB — anchors the "this is the
          KDER coach" identity. Tiny sparkle in the corner cues AI
          without being clip-art. */}
      <Image
        src="/brand/mark-green.png"
        alt=""
        width={28}
        height={28}
        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      />
      <Sparkles
        size={12}
        className="absolute -top-0.5 -right-0.5 text-amber-200 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]"
        aria-hidden
      />
      {/* Soft hover label — desktop only. Keeps the mobile silhouette
          clean while still telegraphing what the button does on cursor
          devices. */}
      <span
        className="pointer-events-none absolute right-[calc(100%+0.5rem)] hidden whitespace-nowrap rounded-full bg-black/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 sm:block"
      >
        Ask Mia
      </span>
    </button>
  );
}
