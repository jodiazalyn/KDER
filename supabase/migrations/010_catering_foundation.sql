-- ============================================================
-- 010 — Catering foundation
-- ============================================================
-- PR 1 of the event-catering feature. Adds:
--   1. listings.kind ('plate' | 'catering') + catering_* columns
--   2. creators.catering_balance_days_before (when cron auto-charges
--      the 70% balance before the event)
--   3. creator_blackouts table (one-off dates + recurring weekday rules)
--
-- Inquiries, quotes, and bookings tables ship in PR 2 and PR 3 so
-- each PR stays focused and reviewable.
-- ============================================================

-- ── listings: catering fields ────────────────────────────────
-- 'plate' default keeps every existing listing unchanged and
-- avoids any migration on the storefront query path.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'plate'
    CHECK (kind IN ('plate', 'catering'));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_pricing_mode text
    CHECK (catering_pricing_mode IN ('per_head', 'flat'));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_min_guests int
    CHECK (catering_min_guests IS NULL OR catering_min_guests > 0);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_max_guests int
    CHECK (catering_max_guests IS NULL OR catering_max_guests > 0);

-- Lead time in hours from order placement to event start. e.g. 72 = 3 days.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_lead_time_hours int
    CHECK (catering_lead_time_hours IS NULL OR catering_lead_time_hours >= 0);

-- Which of pickup / delivery / onsite this catering listing supports.
-- TEXT[] so a listing can offer any subset.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_fulfillment text[] DEFAULT '{}';

-- Inclusions copy ("Includes: 2 proteins, queso, guacamole...").
-- Free text so creators can format as they like — we don't parse it.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_inclusions text;

-- Sanity: catering listings MUST have a pricing mode + min guests.
-- Enforced as a row-level check that's only meaningful when kind='catering'.
ALTER TABLE listings
  ADD CONSTRAINT listings_catering_required_fields
  CHECK (
    kind = 'plate' OR (
      catering_pricing_mode IS NOT NULL
      AND catering_min_guests IS NOT NULL
      AND catering_lead_time_hours IS NOT NULL
    )
  );

-- Index for the new storefront query: "give me this creator's
-- catering listings". Existing idx_listings_creator_status stays —
-- this one is additive.
CREATE INDEX IF NOT EXISTS idx_listings_creator_kind
  ON listings (creator_id, kind, status);

-- ── creators: balance-charge timing ──────────────────────────
-- Default 3 days before event. Per-creator override in their settings.
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS catering_balance_days_before int NOT NULL DEFAULT 3
    CHECK (catering_balance_days_before BETWEEN 1 AND 30);

-- ── creator_blackouts ────────────────────────────────────────
-- Dates the creator is unavailable for catering. Two modes:
--   - one_off: a specific date (blackout_date set, weekday null)
--   - recurring: every {weekday} of the week (weekday set, blackout_date null)
-- Used to (a) disable dates in the customer-facing inquiry calendar
-- and (b) badge the creator's own calendar so they don't over-book.
CREATE TABLE IF NOT EXISTS creator_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('one_off', 'recurring')),
  -- Exactly one of these is set, gated by `kind`.
  blackout_date date,
  weekday int CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blackout_shape CHECK (
    (kind = 'one_off' AND blackout_date IS NOT NULL AND weekday IS NULL)
    OR
    (kind = 'recurring' AND weekday IS NOT NULL AND blackout_date IS NULL)
  ),
  -- Prevent dupes: same creator can't blackout the same date or
  -- weekday twice.
  UNIQUE (creator_id, kind, blackout_date, weekday)
);

CREATE INDEX IF NOT EXISTS idx_creator_blackouts_creator
  ON creator_blackouts (creator_id);

-- Fast lookup for the customer-facing date picker:
-- "give me all one-off blackouts in this date range for this creator".
CREATE INDEX IF NOT EXISTS idx_creator_blackouts_date
  ON creator_blackouts (creator_id, blackout_date)
  WHERE kind = 'one_off';

ALTER TABLE creator_blackouts ENABLE ROW LEVEL SECURITY;

-- Public read so customers can see which dates are unavailable when
-- building an inquiry. Information disclosure is intentional and
-- minimal (just a date + optional reason).
CREATE POLICY "Public can read blackouts"
  ON creator_blackouts FOR SELECT USING (true);

-- Only the creator can write to their own blackouts.
CREATE POLICY "Creator manages own blackouts"
  ON creator_blackouts FOR ALL USING (
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );
