import type { Order } from "@/types";

/**
 * Shape a raw Supabase `orders` row (plus any joined listing data) into the
 * client-facing `Order` type. Used by the orders list + detail API routes.
 *
 * The DB schema doesn't carry every field the UI expects, so we populate:
 *
 *  - member_name: snapshot on the order row at checkout time
 *  - member_photo: null (UI falls back to an initial-letter avatar)
 *  - listing_name: prefer the per-item snapshot in the `items` JSONB, fall
 *    back to the joined listing row for legacy orders pre-`items`
 *  - listing_photo: prefer the per-item snapshot in the `items` JSONB
 *    (set at checkout time so future listing edits / deletions don't break
 *    historical order pages), fall back to the joined listing row for
 *    pre-snapshot orders
 *  - pickup_address / delivery_zip: not used by the current UI beyond a
 *    confirmation banner; return null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToOrder(row: any): Order {
  const firstItem =
    Array.isArray(row.items) && row.items.length > 0 ? row.items[0] : null;
  const joinedListing = row.listing;

  return {
    id: row.id,
    listing_id: row.listing_id,
    member_id: row.member_id,
    creator_id: row.creator_id,
    quantity: Number(row.quantity ?? 1),
    fulfillment_type: row.fulfillment_type,
    status: row.status,
    total_amount: Number(row.total_amount ?? 0),
    platform_fee: Number(row.platform_fee ?? 0),
    creator_payout: Number(row.creator_payout ?? 0),
    notes: row.notes ?? null,
    terms_accepted_at: row.terms_accepted_at,
    auto_decline_at: row.auto_decline_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    delivery_address: row.delivery_address ?? null,
    delivery_zip: null,
    pickup_address: null,
    member_phone: row.member_phone ?? null,
    member_name: row.member_name ?? "Customer",
    member_photo: null,
    listing_name: firstItem?.name ?? joinedListing?.name ?? "Plate",
    listing_photo:
      // Prefer the snapshotted photo from items JSONB so legacy listing
      // edits / deletions don't break historical order pages.
      firstItem?.photo ??
      (Array.isArray(joinedListing?.photos) && joinedListing.photos.length > 0
        ? joinedListing.photos[0]
        : null),
  };
}
