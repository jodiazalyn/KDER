/**
 * Demo mode store for creator profile data.
 * Reads from sessionStorage (set during onboarding).
 */

import { resolveZipToNeighborhood } from "@/data/houston-zips";

export interface CreatorProfile {
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  handle: string;
  neighborhoods: { name: string; zip: string }[];
  storefront_active: boolean;
  vibe_score: number | null;
  total_orders: number;
}

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

  const neighborhoods = zips
    .map((zip) => {
      const resolved = resolveZipToNeighborhood(zip);
      return resolved ? { name: resolved.neighborhood, zip } : null;
    })
    .filter(Boolean) as { name: string; zip: string }[];

  return {
    display_name: profile.display_name || "Creator",
    bio: profile.bio || null,
    photo_url: profile.photo_url || null,
    handle: handle || "mystore",
    neighborhoods,
    storefront_active: storefrontActive !== "false",
    vibe_score: null,
    total_orders: 0,
  };
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
  };
}
