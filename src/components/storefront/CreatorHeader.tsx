"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Share2, Star } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface CreatorHeaderProps {
  creator: CreatorProfile;
  /** A food photo (typically the creator's first plate) used as the
   *  full-bleed hero image. Falls back to the creator's own photo,
   *  then a branded gradient, when absent. */
  heroPhoto: string | null;
}

/**
 * Airbnb-Experiences-style storefront hero.
 *
 * Layout, top-down:
 *   - Full-bleed food photo (the creator's signature plate) with Share +
 *     theme toggle floating top-right and a soft fade into the page.
 *   - A circular chef avatar overlapping the bottom edge of the photo,
 *     centered.
 *   - Centered title (the chef's display name), a short description (bio),
 *     and a single meta line: ★ rating · N reviews · Chef · neighborhood.
 *
 * The chef card (Message button, socials, stats) lives lower on the page in
 * `AboutChef`, mirroring how Airbnb surfaces the host profile below the fold.
 * Every colour comes from theme tokens (or theme-aware glass utilities) so the
 * header renders correctly in both light and dark mode; the only fixed-colour
 * elements are the cover overlay + icon chips, which sit over photographic
 * imagery in either theme.
 */
export function CreatorHeader({ creator, heroPhoto }: CreatorHeaderProps) {
  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = `${creator.display_name} on KDER`;
    const nav = window.navigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ url, title });
        return;
      } catch {
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

  const hasReviews =
    creator.review_count > 0 && creator.review_rating_avg != null;
  const neighborhood = creator.neighborhoods[0]?.name ?? null;
  const cover = heroPhoto ?? creator.photo_url ?? null;

  return (
    <header>
      {/* ---- Full-bleed hero photo ---- */}
      <div className="relative h-[300px] w-full overflow-hidden bg-gradient-to-br from-primary/40 via-primary/15 to-background">
        {cover && (
          <Image
            src={cover}
            alt={`${creator.display_name}'s cooking`}
            fill
            sizes="640px"
            priority
            className="object-cover"
          />
        )}
        {/* Legibility overlay — darkens the top (for the icon chips) and fades
            the bottom into the page background so the avatar blends in. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />

        {/* Floating actions — share + theme toggle */}
        <div className="absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center justify-end gap-2 px-4">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-transform active:scale-90"
          >
            <Share2 size={18} />
          </button>
          <ThemeToggle className="h-10 w-10 border border-white/15 !bg-black/35 text-white backdrop-blur-md" />
        </div>
      </div>

      {/* ---- Centered profile block (avatar overlaps the photo) ---- */}
      <div className="relative z-10 -mt-14 flex flex-col items-center px-5 text-center">
        <div className="rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] p-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          {creator.photo_url ? (
            <Image
              src={creator.photo_url}
              alt={creator.display_name}
              width={104}
              height={104}
              className="h-[104px] w-[104px] rounded-full border-[4px] border-background object-cover"
              priority
            />
          ) : (
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-[4px] border-background bg-primary/15 text-4xl font-bold text-primary">
              {creator.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="mt-4 break-words text-3xl font-extrabold leading-tight tracking-[-0.02em] text-foreground">
          {creator.display_name}
        </h1>

        {creator.bio && (
          <p className="mt-3 max-w-[34rem] whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground/80 line-clamp-3">
            {creator.bio}
          </p>
        )}

        {/* Meta line — ★ rating · N reviews · Chef · neighborhood */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
          {hasReviews && (
            <>
              <span className="flex items-center gap-1 font-bold text-foreground">
                <Star size={15} className="fill-primary text-primary" />
                {creator.review_rating_avg!.toFixed(1)}
              </span>
              <Dot />
              <span>
                {creator.review_count}{" "}
                {creator.review_count === 1 ? "review" : "reviews"}
              </span>
              <Dot />
            </>
          )}
          <span>Chef{neighborhood ? ` in ${neighborhood}` : ""}</span>
        </div>
      </div>
    </header>
  );
}

function Dot() {
  return (
    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/50" />
  );
}
