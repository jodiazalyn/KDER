-- 005_order_reminders.sql
--
-- Adds reminder-tracking columns to `orders` so the cron sweep
-- (src/app/api/v1/cron/order-reminders/route.ts) can escalate
-- creator notifications without sending duplicates, and snapshots the
-- customer's email at checkout time so notifications can reach them
-- without joining back to Stripe.
--
-- The existing `auto_decline_at` column is intentionally NOT dropped:
-- historical orders carry the timestamp and the column is harmless
-- (we just stop ACTING on it; see the removed sweep in
-- src/app/api/v1/orders/route.ts).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reminder_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Reminder sweep query lookup: pending orders, sorted by last_reminder_at
-- and created_at. Partial index keeps it tiny since most orders aren't pending.
CREATE INDEX IF NOT EXISTS idx_orders_pending_reminder
  ON orders (last_reminder_at NULLS FIRST, created_at)
  WHERE status = 'pending';
