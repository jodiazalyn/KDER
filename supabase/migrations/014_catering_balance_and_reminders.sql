-- ============================================================
-- 014 — Catering balance + reminders + completion
-- ============================================================
-- PR 4 of the catering feature. Adds:
--   1. catering_bookings columns for reminder-tracking, completion,
--      and balance-charge retry state
--   2. pg_cron schedules for all four catering sweeps
--      (acceptance-deadline, balance-charge, event-reminders,
--      quote-expiry)
--
-- Vault setup: requires `cron_secret` in Supabase Vault matching the
-- CRON_SECRET env var. Set this once before running — already done
-- for migration 006 (order-reminders), the same secret is reused.
-- ============================================================

-- ── catering_bookings: lifecycle additions ──────────────────

-- Tracks which pre-event reminders have already fired so the cron
-- sweep doesn't double-send. Shape: {"3d": true, "1d": true,
-- "morning_of": true}. Defaults to {} so existing rows are unaffected.
ALTER TABLE catering_bookings
  ADD COLUMN IF NOT EXISTS reminders_sent jsonb NOT NULL DEFAULT '{}'::jsonb;

-- When the creator marks the event complete (or a cron auto-completes
-- a few days after event_date — that auto-close is deferred to a
-- future PR).
ALTER TABLE catering_bookings
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Balance-charge retry tracking. When an off-session charge fails
-- (3DS required, card declined, network glitch), the cron sets
-- last_balance_attempt_at + bumps balance_attempt_count, leaves
-- status='balance_due', and emails the customer a retry link. The
-- cron only retries automatically up to 3 times before giving up
-- (creator can manually retry from the dashboard at any time).
ALTER TABLE catering_bookings
  ADD COLUMN IF NOT EXISTS last_balance_attempt_at timestamptz;
ALTER TABLE catering_bookings
  ADD COLUMN IF NOT EXISTS balance_attempt_count int NOT NULL DEFAULT 0
    CHECK (balance_attempt_count >= 0);
ALTER TABLE catering_bookings
  ADD COLUMN IF NOT EXISTS balance_failure_message text;

-- Index for the pre-event reminders cron: "all confirmed/balance_paid
-- bookings with event_date within the next 7 days." The reminders
-- sweep walks this small set + decides per-row which reminders are
-- still owed based on reminders_sent.
CREATE INDEX IF NOT EXISTS idx_catering_bookings_upcoming
  ON catering_bookings (event_date)
  WHERE status IN ('confirmed', 'balance_paid');

-- ── pg_cron extensions + schedules ──────────────────────────
-- Match the pattern from 006_order_reminder_cron.sql. The cron_secret
-- Vault entry is shared across all KDER cron routes.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ── Quote expiry sweep ─────────────────────────────────────
-- Hourly. Picks up quotes whose 7-day window elapsed without payment
-- and marks them 'expired'.
SELECT cron.unschedule('catering-quote-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catering-quote-expiry');

SELECT cron.schedule(
  'catering-quote-expiry',
  '0 * * * *',  -- top of every hour
  $$
    SELECT net.http_post(
      url := 'https://kder.club/api/v1/cron/catering-quote-expiry',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_secret' LIMIT 1
        ),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- ── Acceptance deadline sweep ──────────────────────────────
-- Every 15 minutes. Auto-declines pending_acceptance bookings past
-- their 4-hour accept_deadline and refunds the deposit.
SELECT cron.unschedule('catering-acceptance-deadline')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catering-acceptance-deadline');

SELECT cron.schedule(
  'catering-acceptance-deadline',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://kder.club/api/v1/cron/catering-acceptance-deadline',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_secret' LIMIT 1
        ),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- ── Balance auto-charge sweep ──────────────────────────────
-- Every 4 hours. Finds confirmed bookings whose
-- balance_charge_scheduled_for is in the past and runs an off-
-- session PaymentIntent. Failures flip to balance_due for retry.
SELECT cron.unschedule('catering-balance-charge')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catering-balance-charge');

SELECT cron.schedule(
  'catering-balance-charge',
  '0 */4 * * *',  -- 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
  $$
    SELECT net.http_post(
      url := 'https://kder.club/api/v1/cron/catering-balance-charge',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_secret' LIMIT 1
        ),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- ── Pre-event reminders sweep ──────────────────────────────
-- Daily at 14:00 UTC (≈9am Central, decent compromise for Houston
-- without a per-creator timezone column). Inside the route, each
-- booking is checked against its event_date and the appropriate
-- 3d/1d/morning-of reminder fires if not already sent.
SELECT cron.unschedule('catering-event-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catering-event-reminders');

SELECT cron.schedule(
  'catering-event-reminders',
  '0 14 * * *',
  $$
    SELECT net.http_post(
      url := 'https://kder.club/api/v1/cron/catering-event-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_secret' LIMIT 1
        ),
        'Content-Type', 'application/json'
      )
    );
  $$
);
