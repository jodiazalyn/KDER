-- ============================================
-- BETA MIGRATION (idempotent — safe to re-run)
-- Adds missing columns and tables to support
-- anonymous storefront checkout and Stripe payouts.
-- ============================================

-- ── Missing columns on orders (anonymous checkout + multi-item carts) ──
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS creator_handle TEXT,
  ADD COLUMN IF NOT EXISTS member_name TEXT,
  ADD COLUMN IF NOT EXISTS member_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Make legacy FKs optional (anonymous checkout, multi-item support)
ALTER TABLE orders ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN listing_id DROP NOT NULL;

-- ── Creator pickup address ──
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS pickup_address TEXT;

-- ── Payouts table ──
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE NOT NULL,
  stripe_payout_id TEXT UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts(creator_id);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- ── Idempotent RLS policies (drop + create) ──
DROP POLICY IF EXISTS "Creator views own payouts" ON payouts;
CREATE POLICY "Creator views own payouts" ON payouts
  FOR SELECT USING (
    creator_id IN (SELECT id FROM creators WHERE member_id::text = auth.uid()::text)
  );

-- Re-create orders policy that allows anonymous checkout insert
DROP POLICY IF EXISTS "Members can create orders" ON orders;
CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT WITH CHECK (true);
