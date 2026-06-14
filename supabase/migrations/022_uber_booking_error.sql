-- ============================================================
-- 022 — Uber Direct: persist courier-booking failures on the order
-- ============================================================
-- When a delivery order is paid, the Stripe `checkout.session.completed`
-- webhook calls bookUberDeliveryForOrder() to dispatch the courier.
-- That call can throw for a dozen reasons (Uber API rejects the
-- pickup/dropoff, the quote expired and re-quote failed, a malformed
-- address, an auth/credentials problem after the prod switch, …). Today
-- the webhook only console.error()s the failure and moves on, so the
-- order is left with uber_delivery_id IS NULL and the customer sees an
-- eternal "Booking your courier…" spinner with no way to know what
-- happened.
--
-- This migration adds two columns so a booking failure is durable and
-- debuggable from the order row itself:
--
--   * uber_booking_error      — the human-readable failure reason
--                               (the thrown Error message, truncated).
--   * uber_booking_failed_at  — when the most recent attempt failed.
--
-- Both are written by the Stripe webhook's catch block and CLEARED back
-- to NULL by bookUberDeliveryForOrder() on a successful booking (so a
-- retry that succeeds wipes the stale error). The order-confirmation
-- page reads uber_booking_error to show a real error state instead of
-- the indefinite spinner.
--
-- Additive, NULL defaults, no backfill, no locks. Safe to ship anytime.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS uber_booking_error text,
  ADD COLUMN IF NOT EXISTS uber_booking_failed_at timestamptz;

COMMENT ON COLUMN orders.uber_booking_error IS
  'Human-readable reason the most recent Uber Direct booking attempt '
  'failed (the thrown Error message, truncated). Written by the Stripe '
  'checkout webhook''s catch block; cleared to NULL by '
  'bookUberDeliveryForOrder() on a successful booking. NULL means '
  'either booking succeeded or this is not an Uber delivery order.';

COMMENT ON COLUMN orders.uber_booking_failed_at IS
  'Timestamp of the most recent failed Uber booking attempt. Cleared '
  'to NULL alongside uber_booking_error when a later attempt succeeds.';
