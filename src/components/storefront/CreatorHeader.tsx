"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Globe, MessageCircle, Share2 } from "lucide-react";
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

        {/* Social links */}
        {(creator.instagram_handle || creator.tiktok_handle || creator.website_url) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {creator.instagram_handle && (
              <a
                href={`https://instagram.com/${creator.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <InstagramIcon className="h-4 w-4 flex-shrink-0" />
                <span>@{creator.instagram_handle}</span>
              </a>
            )}
            {creator.tiktok_handle && (
              <a
                href={`https://tiktok.com/@${creator.tiktok_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <TikTokIcon className="h-4 w-4 flex-shrink-0" />
                <span>@{creator.tiktok_handle}</span>
              </a>
            )}
            {creator.website_url && (
              <a
                href={creator.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <Globe size={16} className="flex-shrink-0" />
                <span className="truncate max-w-[160px]">{displayUrl(creator.website_url)}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* CTA row — Message + Share side-by-side. Bumped 40→44px (Apple HIG)
          and migrated to glass-btn-pill for the iOS Liquid Glass material. */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onMessageClick}
          className="glass-btn-pill flex h-11 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
        >
          <MessageCircle size={15} />
          Message
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="glass-btn-pill flex h-11 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
          aria-label="Share profile"
        >
          <Share2 size={15} />
          Share
        </button>
      </div>
    </header>
  );
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.27 8.27 0 004.84 1.55V6.86a4.85 4.85 0 01-1.07-.17z" />
    </svg>
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
