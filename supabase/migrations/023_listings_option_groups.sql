-- ============================================================
-- 023 — Listings: required option groups (choose-exactly-one)
-- ============================================================
-- Adds "required choices" to plate listings — a SEPARATE concept
-- from the existing optional add-ons (`extras`, migration 018).
--
-- The distinction (straight from creator feedback):
--   * extras        → OPTIONAL. Multi-select. Customer picks any /
--                     none / several (e.g. "Burger Toppings":
--                     Mayo, Mustard, Lettuce…). Unchanged by this
--                     migration.
--   * option_groups → REQUIRED. Choose exactly ONE per group
--                     (e.g. "Protein": 2 Beef Patties vs 2 Black
--                     Bean Patties). The customer MUST pick one to
--                     order — it's a choice, not an add-on.
--
-- Shape:
--   option_groups = [
--     {
--       id: string,          -- stable local id (client-generated)
--       title: string,       -- group label shown to the customer
--       required: bool,      -- v1 always true
--       min: int,            -- v1 always 1
--       max: int,            -- v1 always 1 (choose exactly one)
--       options: [ { name: string, price_cents: int }, ... ]
--     },
--     ...
--   ]
--
-- `min`/`max` are stored (not hardcoded) so a future "choose up to
-- N" variant needs no new migration — v1 just fixes them to 1/1.
-- Per-option `price_cents` may be 0 ("Included") or a positive
-- upcharge (e.g. a premium protein); it snapshots into the cart /
-- order line exactly like an `extras` pick does, so the creator
-- sees the customer's choice on the order.
--
-- Plate-only by convention, same as `extras`: catering listings
-- keep this empty and use structured quote fee_items instead.
--
-- Back-compat: default '[]' on every existing row, no backfill,
-- no row locks. Listings with no groups render exactly as before.
-- Safe to re-run.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS option_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN listings.option_groups IS
  'Plate-only REQUIRED choice groups (choose-exactly-one), distinct '
  'from optional `extras` (018). Each row: {id, title, required, '
  'min, max, options:[{name, price_cents}]}. v1 fixes required=true, '
  'min=1, max=1. The customer must pick one option per group to '
  'order; the pick snapshots into the order line like an extra. '
  'NULL never appears — default is the empty array.';
