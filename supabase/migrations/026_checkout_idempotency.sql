-- 026_checkout_idempotency.sql
--
-- Stop duplicate orders at the source.
--
-- Problem: the checkout endpoint inserts a brand-new order row on every POST
-- (Postgres DEFAULT gen_random_uuid()), with no dedupe. A customer who taps
-- "Place order", lands on Stripe's hosted page, hits back, and taps again
-- creates a SECOND pending/paid_at=NULL phantom row (and a second Checkout
-- Session). Only one ever gets paid -> the creator sees two orders, one charge.
--
-- Fix: the client mints a cart-scoped idempotency key (reset on any cart
-- change / successful order) and sends it with checkout. The server reuses an
-- existing in-flight order carrying that key instead of inserting a duplicate.
-- This column + partial unique index enforce "one live order per key" at the
-- DB level, which also closes the double-tap race.

-- Client-supplied idempotency key for the in-flight checkout attempt. NULL on
-- legacy rows and any keyless (backward-compat) request.
alter table orders
  add column if not exists checkout_idempotency_key text;

-- One order per key. Partial (WHERE NOT NULL) so all legacy rows — and any
-- future keyless row — are exempt from the constraint.
create unique index if not exists orders_checkout_idempotency_key_uniq
  on orders (checkout_idempotency_key)
  where checkout_idempotency_key is not null;
