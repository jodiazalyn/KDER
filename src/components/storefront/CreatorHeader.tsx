"use client";

import { MapPin, Star, ShoppingBag } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";

interface CreatorHeaderProps {
  creator: CreatorProfile;
}

export function CreatorHeader({ creator }: CreatorHeaderProps) {
  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="h-32 bg-gradient-to-b from-green-900/40 to-transparent" />

      <div className="px-4 -mt-16">
        {/* Avatar */}
        <div className="flex items-end gap-4">
          {creator.photo_url ? (
            <img
              src={creator.photo_url}
              alt={creator.display_name}
              className="h-20 w-20 rounded-2xl border-2 border-green-400/30 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-green-400/30 bg-green-900/50 text-3xl font-bold text-green-300 shadow-lg">
              {creator.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-black text-white">
              {creator.display_name}
            </h1>
            <p className="text-sm text-green-300/70">@{creator.handle}</p>
          </div>
        </div>

        {/* Bio */}
        {creator.bio && (
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            {creator.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
          {creator.neighborhoods.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {creator.neighborhoods.map((n) => n.name).join(", ")}
            </span>
          )}
          {creator.vibe_score !== null && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400" />
              {creator.vibe_score.toFixed(1)}
            </span>
          )}
          {creator.total_orders > 0 && (
            <span className="flex items-center gap-1">
              <ShoppingBag size={12} />
              {creator.total_orders} orders
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
