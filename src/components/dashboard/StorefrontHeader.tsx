"use client";

import { useRef, type ChangeEvent } from "react";
import Image from "next/image";
import { Star, MapPin, Camera } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";
import { toast } from "sonner";

interface StorefrontHeaderProps {
  profile: CreatorProfile;
  heroImage: string | null;
  onPhotoChange?: (dataUrl: string) => void;
}

export function StorefrontHeader({ profile, heroImage, onPhotoChange }: StorefrontHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("That photo is too large. Use a photo under 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onPhotoChange?.(reader.result as string);
      toast.success("Profile photo updated!");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <div className="relative h-72 w-full overflow-hidden">
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

      {/* Glass overlay content */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="rounded-3xl border border-white/[0.22] bg-white/[0.14] px-5 py-4 backdrop-blur-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.20),0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="flex items-start gap-4">
            {/* Avatar — tappable to upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-white/[0.1] active:scale-95 transition-transform"
              aria-label={profile.photo_url ? "Change profile photo" : "Upload profile photo"}
            >
              {profile.photo_url ? (
                <Image
                  src={profile.photo_url}
                  alt={profile.display_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white/40">
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Camera overlay on hover/focus */}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden
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
          </div>

          {/* Bottom row: service areas + stats */}
          <div className="mt-3 flex items-center justify-between">
            {/* Service areas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {profile.neighborhoods.length > 0 ? (
                profile.neighborhoods.map((n) => (
                  <span
                    key={n.zip}
                    className="flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-[8px]"
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
