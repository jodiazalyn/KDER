/**
 * Creator profile store.
 * Reads from Supabase in production, falls back to sessionStorage.
 */

import { resolveZipToNeighborhood } from "@/data/houston-zips";
import { createClient } from "@/lib/supabase/client";
import type { DiscountCode } from "@/types";

export interface CreatorProfile {
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  handle: string;
  /** Creators-table id. Used to scope per-visitor lookups (e.g. the
   *  "your active order with this creator" banner). Optional because
   *  some legacy callers only fill members.id. */
  creator_id?: string | null;
  /** Creator's user id (members.id). Used as recipient_id for messaging. */
  member_id: string | null;
  /** Email — required at onboarding for order notifications. Null only
   *  for legacy creators who signed up before email collection landed
   *  (surfaced via dashboard banner). */
  email: string | null;
  neighborhoods: { name: string; zip: string }[];
  storefront_active: boolean;
  vibe_score: number | null;
  /** Denormalized average star rating from order_reviews (migration
   *  021). Null until the creator's first review lands. Drives the
   *  storefront header rating display. */
  review_rating_avg: number | null;
  /** Count of order_reviews backing review_rating_avg. */
  review_count: number;
  total_orders: number;
  total_plates: number;
  pickup_address: string | null;
  /** Flat self-delivery fee in cents (migration 025). 0 = free delivery.
   *  Charged when the creator delivers the order themselves (no Uber
   *  courier) and paid out to the creator, not the platform. */
  delivery_fee_cents: number;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  website_url: string | null;
  facebook_handle: string | null;
  whatsapp_number: string | null;
  /** Creator-owned promo codes (migration 024). Empty array when the
   *  creator hasn't defined any. Only populated on the authed Supabase
   *  path; the sessionStorage fallbacks return []. */
  discount_codes: DiscountCode[];
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
      // The members and creators rows are independent given user.id —
      // run them in parallel to halve the round-trip cost.
      const [memberRes, creatorRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("members")
          .select("display_name, handle, photo_url, bio, email, instagram_handle, tiktok_handle, website_url, facebook_handle, whatsapp_number")
          .eq("id", user.id)
          .single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("creators")
          .select("service_zip_codes, storefront_active, vibe_score, review_rating_avg, review_count, pickup_address, discount_codes, delivery_fee_cents")
          .eq("member_id", user.id)
          .single(),
      ]);
      const member = memberRes.data;
      const creator = creatorRes.data;

      if (member) {
        const zips: string[] = creator?.service_zip_codes || [];
        const neighborhoods = resolveZips(zips);

        return {
          display_name: member.display_name || "Creator",
          bio: member.bio || null,
          photo_url: member.photo_url || null,
          handle: member.handle || "mystore",
          member_id: user.id,
          email: member.email || null,
          neighborhoods,
          storefront_active: creator?.storefront_active ?? true,
          vibe_score: creator?.vibe_score
            ? Number(creator.vibe_score)
            : null,
          review_rating_avg:
            creator?.review_rating_avg != null
              ? Number(creator.review_rating_avg)
              : null,
          review_count: creator?.review_count ?? 0,
          total_orders: 0,
          total_plates: 0,
          pickup_address: creator?.pickup_address || null,
          delivery_fee_cents:
            typeof creator?.delivery_fee_cents === "number"
              ? creator.delivery_fee_cents
              : 0,
          instagram_handle: member.instagram_handle || null,
          tiktok_handle: member.tiktok_handle || null,
          website_url: member.website_url || null,
          facebook_handle: member.facebook_handle || null,
          whatsapp_number: member.whatsapp_number || null,
          discount_codes: Array.isArray(creator?.discount_codes)
            ? creator.discount_codes
            : [],
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
    member_id: null,
    email: profile.email || null,
    neighborhoods,
    storefront_active: storefrontActive !== "false",
    vibe_score: null,
    review_rating_avg: null,
    review_count: 0,
    total_orders: 0,
    total_plates: 0,
    pickup_address: profile.pickup_address || null,
    delivery_fee_cents:
      typeof profile.delivery_fee_cents === "number"
        ? profile.delivery_fee_cents
        : 0,
    instagram_handle: profile.instagram_handle || null,
    tiktok_handle: profile.tiktok_handle || null,
    website_url: profile.website_url || null,
    facebook_handle: profile.facebook_handle || null,
    whatsapp_number: profile.whatsapp_number || null,
    discount_codes: [],
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
    member_id: null,
    email: null,
    neighborhoods: [],
    storefront_active: true,
    vibe_score: null,
    review_rating_avg: null,
    review_count: 0,
    total_orders: 0,
    total_plates: 0,
    pickup_address: null,
    delivery_fee_cents: 0,
    instagram_handle: null,
    tiktok_handle: null,
    website_url: null,
    facebook_handle: null,
    whatsapp_number: null,
    discount_codes: [],
  };
}
