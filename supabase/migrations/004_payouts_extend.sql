-- ============================================
-- PAYOUTS EXTENSION + DISPUTES (idempotent)
-- Extends `payouts` to mirror Stripe payouts fully
-- (method, arrival_date, fee, cents-precision amount).
-- Caches `payouts_enabled` + `default_currency` on
-- `creators` so the checkout hot-path doesn't need
-- a Stripe accounts.retrieve on every order.
-- Adds a `disputes` table for the stub handler to
-- write to (UI is a follow-up).
-- ============================================

-- ── Extend payouts ──────────────────────────────────────────
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS method TEXT
    CHECK (method IN ('standard', 'instant')),
  ADD COLUMN IF NOT EXISTS arrival_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Backfill cents from existing dollars-numeric column. Skip rows
-- where amount is null (shouldn't happen given the NOT NULL
-- constraint in 001, but defensive).
UPDATE payouts
   SET amount_cents = ROUND(amount * 100)::INTEGER
 WHERE amount_cents IS NULL AND amount IS NOT NULL;

-- Hot path: load the most-recent N payouts for a creator.
CREATE INDEX IF NOT EXISTS idx_payouts_creator_created
  ON payouts(creator_id, created_at DESC);

-- ── Cache booleans on creators ──────────────────────────────
-- Avoid stripe.accounts.retrieve on every checkout — read from
-- the cached column, which the account.updated webhook keeps
-- in sync.
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'usd';

-- ── Disputes (stub handler writes here; UI deferred) ────────
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  order_id UUID REFERENCES orders(id),
  creator_id UUID REFERENCES creators(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_creator ON disputes(creator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator views own disputes" ON disputes;
CREATE POLICY "Creator views own disputes" ON disputes
  FOR SELECT USING (
    creator_id IN (SELECT id FROM creators WHERE member_id::text = auth.uid()::text)
  );
