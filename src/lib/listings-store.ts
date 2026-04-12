import type { Listing, ListingStatus, FulfillmentType } from "@/types";

const STORAGE_KEY = "kder_listings";

function generateId(): string {
  return `listing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getListings(): Listing[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getListingsByStatus(status: ListingStatus): Listing[] {
  return getListings().filter((l) => l.status === status);
}

export function getListing(id: string): Listing | null {
  return getListings().find((l) => l.id === id) ?? null;
}

export function createListing(
  data: Omit<Listing, "id" | "creator_id" | "order_count" | "created_at" | "updated_at">
): Listing {
  const listings = getListings();
  const now = new Date().toISOString();

  const listing: Listing = {
    ...data,
    id: generateId(),
    creator_id: "demo_creator",
    order_count: 0,
    created_at: now,
    updated_at: now,
  };

  listings.unshift(listing);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  return listing;
}

export function updateListing(
  id: string,
  data: Partial<Omit<Listing, "id" | "creator_id" | "created_at">>
): Listing | null {
  const listings = getListings();
  const index = listings.findIndex((l) => l.id === id);
  if (index === -1) return null;

  listings[index] = {
    ...listings[index],
    ...data,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  return listings[index];
}

export function duplicateListing(id: string): Listing | null {
  const original = getListing(id);
  if (!original) return null;

  return createListing({
    name: `${original.name} (Copy)`.slice(0, 60),
    description: original.description,
    price: original.price,
    quantity: original.quantity,
    min_order: original.min_order,
    photos: [...original.photos],
    video: original.video,
    fulfillment_type: original.fulfillment_type as FulfillmentType,
    status: "draft",
    category_tags: [...original.category_tags],
    allergens: [...original.allergens],
    availability_windows: [...original.availability_windows],
    discount_codes: [...original.discount_codes],
  });
}

export function deleteListing(id: string): void {
  const listings = getListings().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}
