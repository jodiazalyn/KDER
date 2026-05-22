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
        {(creator.instagram_handle || creator.tiktok_handle || creator.website_url || creator.facebook_handle || creator.whatsapp_number) && (
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
            {creator.facebook_handle && (
              <a
                href={`https://facebook.com/${creator.facebook_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <FacebookIcon className="h-4 w-4 flex-shrink-0" />
                <span>@{creator.facebook_handle}</span>
              </a>
            )}
            {creator.whatsapp_number && (
              <a
                href={`https://wa.me/${creator.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <WhatsAppIcon className="h-4 w-4 flex-shrink-0" />
                <span>WhatsApp</span>
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

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
