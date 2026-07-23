-- 025_self_delivery.sql
--
-- Self-delivery: the creator drives the order to the customer themselves,
-- with NO Uber Direct courier. Uber Direct isn't live yet, but creators are
-- already hand-delivering, so "Delivery" at checkout needs to work without a
-- courier quote.
--
-- Model:
--   * Creators set ONE flat per-storefront delivery fee (default free / $0).
--   * The fee is ZIP-gated to the creator's existing `service_zip_codes`.
--   * Because the CREATOR is driving, the delivery fee is paid out to THEM —
--     it's added to `creator_payout`, NOT to the platform application fee.
--     KDER's 10% still applies only to the food subtotal.
--
-- The Uber Direct columns (orders.uber_quote_id / uber_fee_cents, migration
-- 019) are left untouched and dormant so that path can be re-enabled later.

-- Creator's flat self-delivery fee, in cents. 0 = free delivery.
alter table creators
  add column if not exists delivery_fee_cents integer not null default 0;

alter table creators
  add constraint creators_delivery_fee_cents_nonneg
  check (delivery_fee_cents >= 0) not valid;

comment on column creators.delivery_fee_cents is
  'Flat fee (cents) the creator charges when they deliver an order themselves. 0 = free. Paid out to the creator, not the platform.';

-- Per-order self-delivery context.
--   * self_delivery: creator is driving this one (no Uber courier).
--   * delivery_fee_cents: snapshot of creators.delivery_fee_cents at checkout.
--     Null for pickup / Uber orders.
alter table orders
  add column if not exists self_delivery boolean not null default false;

alter table orders
  add column if not exists delivery_fee_cents integer;

comment on column orders.self_delivery is
  'True when the creator is delivering this order themselves (no Uber courier). Set at checkout when fulfillment_type=delivery and no Uber quote was attached.';
comment on column orders.delivery_fee_cents is
  'Self-delivery fee charged on this order (cents), snapshotted from creators.delivery_fee_cents at checkout. Null for pickup / Uber orders. Included in creator_payout, not platform_fee.';
