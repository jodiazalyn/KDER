-- ============================================================
-- 024 — Creator promo codes (per-creator discount codes)
-- ============================================================
-- Adds creator-owned promo codes. A creator defines codes on their
-- storefront (e.g. "SUMMER10 = 10% off orders over $25"); customers
-- enter one at checkout and the server validates + applies it.
--
-- WHY per-creator (not per-listing): the cart is keyed per-creator-
-- handle (see src/lib/cart-store.ts), so a promo naturally scopes to
-- one creator's whole storefront. A dormant per-listing
-- `listings.discount_codes` stub predates this; it is intentionally
-- left unused — codes live on the creator instead.
--
-- Shape of creators.discount_codes:
--   [{ code: string,               -- uppercase A-Z0-9, unique per creator
--      type: "percentage"|"fixed", -- percent-off or fixed-cents-off
--      value: int,                 -- percentage 1..100, OR cents for fixed
--      min_order: int | null,      -- min food subtotal in CENTS to qualify
--      expires_at: string | null   -- ISO date; null = never expires
--   }, ...]
--
-- FEE MODEL (proportional): the discount reduces the food subtotal;
-- KDER's platform fee is recomputed as PLATFORM_FEE_PERCENT of the
-- DISCOUNTED subtotal, so the platform's effective take stays exactly
-- that percent of what the customer actually paid. The creator absorbs
-- the remainder of their own promo. Enforced server-side in
-- src/app/api/v1/checkout/route.ts — never trust a client-supplied
-- discount amount.
--
-- orders.discount_code / orders.discount_cents snapshot what was
-- applied so the order detail page, creator reporting, and any refund
-- math can reconstruct the sale.
--
-- Back-compat: defaults on every existing row, no backfill, no row
-- locks. Safe to re-run.
-- ============================================================

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS discount_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN creators.discount_codes IS
  'Creator-owned promo codes applied at checkout. Each row: '
  '{code: string (uppercase A-Z0-9), type: "percentage"|"fixed", '
  'value: int (percentage 1..100, or cents for fixed), '
  'min_order: int|null (min food subtotal in CENTS), '
  'expires_at: string|null (ISO date)}. Validated + applied '
  'server-side at checkout with a proportional platform-fee model. '
  'NULL never appears — default is the empty array.';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.discount_code IS
  'The promo code applied to this order (uppercase), or NULL if none. '
  'Snapshotted at checkout for order display / reporting.';

COMMENT ON COLUMN orders.discount_cents IS
  'Amount discounted from the food subtotal in cents (0 if no promo). '
  'total_amount and creator_payout already reflect this reduction.';
