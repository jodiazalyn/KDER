-- ============================================================
-- 018 — Listings: plate extras (creator-defined add-ons)
-- ============================================================
-- Adds the "Extras" feature: each plate listing carries an optional
-- list of add-ons (drinks, desserts, sides, extra sauce) that the
-- customer can pick at checkout. Lets creators upsell without
-- forcing the customer into a second order.
--
-- Shape:
--   extras = [{ name: string, price_cents: int }, ...]
-- price_cents may be 0 — "extra spice" is a perfectly valid free
-- add-on. Customers pick a per-extra quantity in the plate detail
-- sheet; the cart line snapshots their picks (name + price) so a
-- creator editing the listing later doesn't retroactively change
-- pending carts.
--
-- Plate-only by convention: catering listings keep this empty and
-- use the structured fee_items on quotes (migration 016) for the
-- same role.
--
-- Back-compat: default '[]' on every existing row, no backfill
-- needed, no row locks. Safe to re-run.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN listings.extras IS
  'Plate-only optional add-ons offered at checkout. Each row: '
  '{name: string, price_cents: int}. price_cents may be 0 (free '
  'extras like "extra spice"). Customers pick a per-extra quantity '
  'on the plate detail sheet; the cart line snapshots their picks. '
  'NULL never appears — default is the empty array.';
