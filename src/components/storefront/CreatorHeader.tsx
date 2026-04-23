"use client";

import { useCallback } from "react";
import Image from "next/image";
import { MessageCircle, Share2 } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";
import { toast } from "sonner";

interface CreatorHeaderProps {
  creator: CreatorProfile;
  onMessageClick: () => void;
}

/**
 * Instagram-style profile header for the public `/@handle` storefront.
 *
 * Layout, top-down:
 *   - Row: 80px circular avatar on the left, 3-column stats row on the right
 *     (Plates / Orders / Rating). Stats are dense and scannable.
 *   - Display name (bold), @handle (muted green), bio (two-line clamp).
 *   - CTA row: [Message] [Share] side-by-side.
 *
 * No hero banner, no gradient band. Plain dark background — the app shell
 * already provides the #0A0A0A page bg.
 */
export function CreatorHeader({ creator, onMessageClick }: CreatorHeaderProps) {
  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = `${creator.display_name} on KDER`;
    // Prefer the Web Share API when available (mobile Safari/Chrome + some
    // desktop browsers). Fall back to copying the URL to clipboard so desktop
    // users still get a useful action.
    const nav = window.navigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ url, title });
        return;
      } catch {
        // User dismissed the share sheet — no toast, not an error.
        return;
      }
    }
    try {
      await nav.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  }, [creator.display_name]);

  return (
    <header className="px-4 pt-6 pb-5">
      {/* Avatar + stats row */}
      <div className="flex items-center gap-6">
        {creator.photo_url ? (
          <Image
            src={creator.photo_url}
            alt={creator.display_name}
            width={80}
            height={80}
            className="h-20 w-20 flex-shrink-0 rounded-full border border-white/10 object-cover"
            priority
          />
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-green-900/40 text-3xl font-bold text-green-300">
            {creator.display_name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex flex-1 justify-around">
          <Stat value={creator.total_plates.toString()} label="Plates" />
          <Stat
            value={`${(creator.vibe_score ?? 5).toFixed(1)}★`}
            label="Rating"
          />
        </div>
      </div>

      {/* Name + handle + bio */}
      <div className="mt-4">
        <h1 className="text-lg font-bold leading-tight text-white">
          {creator.display_name}
        </h1>
        <p className="text-sm font-medium text-green-300/80">
          @{creator.handle}
        </p>
        {creator.bio && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70 line-clamp-3">
            {creator.bio}
          </p>
        )}
      </div>

      {/* CTA row — Message + Share side-by-side */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onMessageClick}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
        >
          <MessageCircle size={15} />
          Message
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
          aria-label="Share profile"
        >
          <Share2 size={15} />
          Share
        </button>
      </div>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold leading-tight text-white">
        {value}
      </span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wide text-white/50">
        {label}
      </span>
      {/* Subtle KDER flourish under each stat so the column doesn't feel bare.
          Low opacity + small size keeps the number and label as the focal point. */}
      <Image
        src="/icons/kder-logo.png"
        alt=""
        width={16}
        height={16}
        aria-hidden="true"
        className="mt-1.5 h-4 w-4 opacity-30"
      />
    </div>
  );
}
