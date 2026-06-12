-- 021_order_reviews_and_receipt
-- Order completion + review loop.
--
-- Today the order lifecycle ends when the CREATOR taps "complete"
-- (which triggers payout). That stays unchanged. But the customer
-- never closes the loop — there's no signal that they actually
-- received the food, and no lightweight star rating that rolls up
-- into a creator's public reputation. This migration adds both:
--
--   1. orders receipt-confirmation columns. After the creator
--      completes an order, the customer is asked "did you receive
--      it?" Their answer (received / problem) lands here, plus an
--      optional free-text note describing the problem. The team
--      gets pinged in Slack on every confirmation so a dispute can
--      be handled by a human. Payout is NOT gated on this — it's a
--      post-hoc receipt + dispute trail.
--
--   2. order_reviews — a simple one-row-per-order star review the
--      customer leaves right after confirming receipt. Stars (1-5)
--      are required; the written body is optional; the whole step
--      is skippable. Distinct from vibe_ratings (the 5-dimension
--      reputation system) which is a separate, heavier flow.
--
--   3. creators rating aggregate columns. Denormalized
--      review_rating_avg + review_count so the storefront header
--      can render a real average without scanning order_reviews on
--      every page load. Recomputed by the review POST endpoint
--      inside the same request that inserts the review.
--
-- All additive + idempotent. No backfill: existing orders simply
-- have NULL receipt columns (never-confirmed), and creators start
-- at review_count 0 / NULL avg until their first review lands.

-- ── 1. orders receipt-confirmation columns ────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS received_confirmed_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS receipt_status TEXT
    CHECK (receipt_status IS NULL OR receipt_status IN ('received', 'problem'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS receipt_note TEXT;

COMMENT ON COLUMN orders.received_confirmed_at IS
  'When the customer confirmed the order outcome (received OR reported a problem). NULL = not yet confirmed. Independent of payout, which fires on the creator completing the order.';
COMMENT ON COLUMN orders.receipt_status IS
  'Customer-reported outcome after creator completion: received | problem. NULL until confirmed.';
COMMENT ON COLUMN orders.receipt_note IS
  'Optional free-text the customer adds when reporting a problem. Posted to the ops Slack channel for dispute handling.';

-- ── 2. order_reviews ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One review per order. UNIQUE so a double-submit can't create
  -- two reviews; the API upserts on conflict.
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_reviews_creator ON order_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_member ON order_reviews(member_id);

COMMENT ON TABLE order_reviews IS
  'Customer star review left after confirming receipt of an order. Stars required (1-5), body optional, step skippable. One row per order.';

-- ── 3. creators rating aggregate columns ──────────────────────────
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS review_rating_avg NUMERIC(3,2);

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN creators.review_rating_avg IS
  'Denormalized average star rating across order_reviews for this creator. NULL until the first review. Recomputed by the review POST endpoint.';
COMMENT ON COLUMN creators.review_count IS
  'Denormalized count of order_reviews for this creator. Drives the storefront header rating display.';

-- ── 4. RLS ────────────────────────────────────────────────────────
-- API writes go through the service-role client (the route is the
-- integrity layer: it authorizes the caller to the order's member_id
-- and enforces the 1-5 rating). These policies cover the direct-read
-- paths so the table is safe even if queried with a user session.
ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (they feed public creator reputation).
DROP POLICY IF EXISTS "order_reviews_select_public" ON order_reviews;
CREATE POLICY "order_reviews_select_public" ON order_reviews
  FOR SELECT USING (true);

-- A member can insert their own review (defense in depth; the API
-- normally writes via service role).
DROP POLICY IF EXISTS "order_reviews_insert_own" ON order_reviews;
CREATE POLICY "order_reviews_insert_own" ON order_reviews
  FOR INSERT WITH CHECK (member_id = auth.uid());
