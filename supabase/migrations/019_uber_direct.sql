-- ============================================================
-- 019 — Uber Direct: on-demand delivery for plate orders (v1)
-- ============================================================
-- Phase 1 of the Uber Direct integration. Adds:
--   * pickup_address + pickup_instructions on `listings` so a
--     delivery-eligible plate listing carries the address Uber
--     will dispatch the courier to. Required at the API layer
--     before a listing with delivery can be set to `active`.
--
--   * uber_* columns on `orders` to track the live delivery
--     state: which Uber delivery this order maps to, what the
--     quoted fee was, current status, when it last changed, the
--     customer-facing tracking URL, and the actual dropoff
--     address the customer typed at checkout.
--
-- Why on `orders` + not a separate `deliveries` table:
--   Every plate order has at most one Uber delivery (1:1). A
--   side table would mean a join on every order render for no
--   data-model win. Wider rows are cheap.
--
-- Why NULL on legacy / pickup-only orders:
--   `uber_delivery_id IS NULL` is the canonical "this order
--   isn't delivered by Uber" signal. The render path branches
--   on it cleanly.
--
-- Back-compat: additive, NULL defaults, no row locks, no
-- backfill. Safe to ship before any Phase 1 code.
-- ============================================================

-- ── listings: pickup address (the creator's kitchen) ─────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text;

COMMENT ON COLUMN listings.pickup_address IS
  'Plate-only: where Uber Direct dispatches the courier to pick '
  'up the food. Free-text human-readable street address; we let '
  'Uber server-side-geocode it at quote time. Required at the '
  'API layer before a delivery-eligible listing can be set to '
  '`active`. NULL on pickup-only listings and on catering '
  '(catering has its own pickup logic via the inquiry/booking '
  'flow).';

COMMENT ON COLUMN listings.pickup_instructions IS
  'Optional notes shown to the Uber courier at pickup. E.g. '
  '"Ring doorbell at side gate" or "Through the green door, '
  'not the front entrance." Max 280 chars per Uber Direct.';

-- ── orders: live Uber delivery state ─────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS uber_delivery_id text,
  ADD COLUMN IF NOT EXISTS uber_quote_id text,
  ADD COLUMN IF NOT EXISTS uber_fee_cents int,
  ADD COLUMN IF NOT EXISTS uber_status text
    CHECK (
      uber_status IS NULL OR
      uber_status IN (
        'pending', 'pickup', 'pickup_complete',
        'dropoff', 'delivered', 'canceled', 'returned'
      )
    ),
  ADD COLUMN IF NOT EXISTS uber_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS uber_tracking_url text,
  ADD COLUMN IF NOT EXISTS dropoff_address text,
  ADD COLUMN IF NOT EXISTS dropoff_instructions text;

COMMENT ON COLUMN orders.uber_delivery_id IS
  'Uber Direct delivery id (e.g. del_xxxxx). NULL means this '
  'order is pickup-only or pre-Uber-integration. Created on the '
  'Stripe payment_intent.succeeded webhook by POST '
  '/customers/{customer_id}/deliveries.';

COMMENT ON COLUMN orders.uber_quote_id IS
  'The dqt_xxx id the customer accepted at checkout. Stored so '
  'we can reuse it on createDelivery (Uber binds quotes to the '
  'pickup/dropoff pair). Quotes expire ~5-15 min; if the '
  'payment took too long, we re-quote server-side before '
  'creating the delivery.';

COMMENT ON COLUMN orders.uber_fee_cents IS
  'The fee Uber returned at quote time, pass-through 1:1 to the '
  'customer. We send this as part of Stripe `application_fee` '
  'so the delivery slice routes to KDER (merchant of record) '
  'instead of to the creator.';

COMMENT ON COLUMN orders.uber_status IS
  'Mirrors the Uber Direct delivery state machine. Updated only '
  'by /api/v1/uber/webhook after signature verification — '
  'never set anywhere else server-side.';

CREATE INDEX IF NOT EXISTS idx_orders_uber_delivery_id
  ON orders (uber_delivery_id)
  WHERE uber_delivery_id IS NOT NULL;
