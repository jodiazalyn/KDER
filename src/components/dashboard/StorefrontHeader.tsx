"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Settings } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";
import { EditableAvatar } from "@/components/shared/EditableAvatar";

interface StorefrontHeaderProps {
  profile: CreatorProfile;
  heroImage: string | null;
  onPhotoChange?: (url: string) => void;
}

export function StorefrontHeader({ profile, heroImage, onPhotoChange }: StorefrontHeaderProps) {
  return (
    // The hero is a media surface — a blurred photo (or green radial) under a
    // dark readability overlay — so its glass card + white text are meant to
    // sit on a dark zone. Pin it `dark` so the glass stays dark-frosted and the
    // white text stays readable regardless of the page's light/dark theme.
    <div className="dark relative h-72 w-full overflow-hidden">
      {/* Hero background */}
      {heroImage ? (
        <Image
          src={heroImage}
          alt=""
          fill
          className="object-cover blur-sm scale-105"
          priority
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(46,125,50,0.2) 0%, transparent 65%)",
          }}
        />
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

      {/* Glass overlay content — glass-card-elevated for depth +
          glass-shine for the specular highlight (the hero card on
          the dashboard's most-viewed surface). */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="glass-card-elevated glass-shine rounded-glass-xl px-5 py-4">
          <div className="flex items-start gap-4">
            {/* Avatar — tappable to upload + auto-saves to DB */}
            <EditableAvatar
              value={profile.photo_url}
              onSaved={(url) => onPhotoChange?.(url)}
              size={64}
              className="flex-shrink-0 border-2 border-white/20"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1
                className="text-xl font-black text-white"
                style={{
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.8))",
                }}
              >
                {profile.display_name}
              </h1>
              <p className="text-sm font-medium text-green-300">
                @{profile.handle}
              </p>
              {profile.bio && (
                <p className="mt-1 text-xs text-white/60 line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Edit profile — pill button with proper tap target
                (h-11 w-11 = 44px, Apple HIG minimum). */}
            <Link
              href="/settings"
              className="glass-btn-pill flex h-11 w-11 flex-shrink-0 items-center justify-center text-white/70 hover:text-white active:scale-90 transition-transform"
              aria-label="Edit profile"
            >
              <Settings size={18} />
            </Link>
          </div>

          {/* Bottom row: service areas + stats */}
          <div className="mt-3 flex items-center justify-between">
            {/* Service areas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {profile.neighborhoods.length > 0 ? (
                profile.neighborhoods.map((n) => (
                  <span
                    key={n.zip}
                    // Read-only neighborhood pill — uses glass-surface-sm
                    // for the lightest blur tier (these stack horizontally
                    // and shouldn't compete visually with the hero card).
                    className="glass-surface-sm flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-white/70"
                  >
                    <MapPin size={10} className="text-green-400" />
                    {n.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white/30">No service areas set</span>
              )}
            </div>

            {/* Vibe + orders */}
            <div className="flex items-center gap-3 flex-shrink-0 pl-2">
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Star size={12} className="text-green-400" />
                {profile.vibe_score ? profile.vibe_score.toFixed(1) : "New"}
              </span>
              <span className="text-xs text-white/40">
                {profile.total_orders} orders
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
