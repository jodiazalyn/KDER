-- ============================================================
-- 017 — Listings: pre-order availability date for plates
-- ============================================================
-- Adds the "Instant vs Pre-order" choice to plate listings. When a
-- creator marks a plate as pre-order they pick the date the food
-- will actually be ready, and the storefront surfaces that date as
-- a pill on the photo + an "Available {date}" banner in the detail
-- sheet.
--
-- Why one nullable column instead of two (bool + date):
--   * NULL  → instant plate (the default, ready now)
--   * a date → pre-order plate, food ready on that date
-- One column means we can't get into a "marked pre-order but
-- forgot the date" half-broken state.
--
-- Catering listings already have their own date model (the
-- customer-supplied event_date on the inquiry / quote / booking),
-- so this column doesn't apply to them. The form hides the toggle
-- when kind = 'catering'; the column stays NULL for those rows.
--
-- Back-compat: every existing listing row gets NULL automatically,
-- which means "instant" — the prior default behavior. No data
-- migration needed.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pre_order_available_date date;

COMMENT ON COLUMN listings.pre_order_available_date IS
  'When set, this plate is a pre-order — food will be ready on this '
  'date. NULL = instant (the default; food is ready now). Only '
  'meaningful for kind=''plate''. The storefront surfaces this as a '
  'PRE-ORDER pill on the photo + an "Available {date}" banner under '
  'the photo in the detail sheet.';
