/**
 * Creator profile store.
 * Reads from Supabase in production, falls back to sessionStorage.
 */

import { resolveZipToNeighborhood } from "@/data/houston-zips";
import { createClient } from "@/lib/supabase/client";

export interface CreatorProfile {
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  handle: string;
  neighborhoods: { name: string; zip: string }[];
  storefront_active: boolean;
  vibe_score: number | null;
  total_orders: number;
  pickup_address: string | null;
}

/**
 * Async profile loader — tries Supabase first, falls back to sessionStorage.
 */
export async function getCreatorProfileAsync(): Promise<CreatorProfile> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: member } = await (supabase as any)
        .from("members")
        .select("display_name, handle, photo_url, bio")
        .eq("id", user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: creator } = await (supabase as any)
        .from("creators")
        .select("service_zip_codes, storefront_active, vibe_score")
        .eq("member_id", user.id)
        .single();

      if (member) {
        const zips: string[] = creator?.service_zip_codes || [];
        const neighborhoods = resolveZips(zips);

        return {
          display_name: member.display_name || "Creator",
          bio: member.bio || null,
          photo_url: member.photo_url || null,
          handle: member.handle || "mystore",
          neighborhoods,
          storefront_active: creator?.storefront_active ?? true,
          vibe_score: creator?.vibe_score
            ? Number(creator.vibe_score)
            : null,
          total_orders: 0,
          pickup_address: creator?.pickup_address || null,
        };
      }
    }
  } catch {
    // Fall through to sessionStorage
  }

  return getCreatorProfile();
}

/**
 * Sync profile loader — reads from sessionStorage (demo/onboarding fallback).
 */
export function getCreatorProfile(): CreatorProfile {
  if (typeof window === "undefined") {
    return defaultProfile();
  }

  const profileRaw = sessionStorage.getItem("kder_onboarding_profile");
  const handle = sessionStorage.getItem("kder_onboarding_handle");
  const zipsRaw = sessionStorage.getItem("kder_onboarding_zips");
  const storefrontActive = localStorage.getItem("kder_storefront_active");

  const profile = profileRaw ? JSON.parse(profileRaw) : {};
  const zips: string[] = zipsRaw ? JSON.parse(zipsRaw) : [];
  const neighborhoods = resolveZips(zips);

  return {
    display_name: profile.display_name || "Creator",
    bio: profile.bio || null,
    photo_url: profile.photo_url || null,
    handle: handle || "mystore",
    neighborhoods,
    storefront_active: storefrontActive !== "false",
    vibe_score: null,
    total_orders: 0,
    pickup_address: profile.pickup_address || null,
  };
}

function resolveZips(zips: string[]): { name: string; zip: string }[] {
  return zips
    .map((zip) => {
      const resolved = resolveZipToNeighborhood(zip);
      // If it's a Houston zip, use the neighborhood name; otherwise use the zip itself
      return resolved
        ? { name: resolved.neighborhood, zip }
        : zip.length === 5
          ? { name: zip, zip }
          : null;
    })
    .filter(Boolean) as { name: string; zip: string }[];
}

export function setStorefrontActive(active: boolean) {
  localStorage.setItem("kder_storefront_active", String(active));
}

function defaultProfile(): CreatorProfile {
  return {
    display_name: "Creator",
    bio: null,
    photo_url: null,
    handle: "mystore",
    neighborhoods: [],
    storefront_active: true,
    vibe_score: null,
    total_orders: 0,
    pickup_address: null,
  };
}
