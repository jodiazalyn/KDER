-- KDER Database Schema
-- Hospitality Sovereignty Platform
-- Per Architecture v5 Core Data Model

-- ============================================
-- TABLES
-- ============================================

-- Members (all users — members + creators)
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT UNIQUE,
  photo_url TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'creator')),
  stripe_customer_id TEXT,
  inbox_active BOOLEAN DEFAULT true,
  last_handle_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creators (extends member with creator-specific data)
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL UNIQUE,
  legal_name TEXT,
  dob DATE,
  stripe_connect_id TEXT,
  kyc_status TEXT DEFAULT 'not_started' CHECK (kyc_status IN ('not_started', 'pending', 'verified', 'failed')),
  service_zip_codes TEXT[] DEFAULT '{}',
  vibe_score NUMERIC(3,2),
  storefront_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listings (plate listings)
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  min_order NUMERIC(10,2),
  photos TEXT[] DEFAULT '{}',
  video TEXT,
  fulfillment_type TEXT DEFAULT 'pickup' CHECK (fulfillment_type IN ('pickup', 'delivery', 'both')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  category_tags TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  availability_windows JSONB DEFAULT '[]',
  discount_codes JSONB DEFAULT '[]',
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) NOT NULL,
  member_id UUID REFERENCES members(id) NOT NULL,
  creator_id UUID REFERENCES creators(id) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery', 'both')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'ready', 'completed', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  creator_payout NUMERIC(10,2) NOT NULL,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_decline_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages (general inbox + order-scoped threads)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES members(id) NOT NULL,
  recipient_id UUID REFERENCES members(id) NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vibe Ratings (post-order reputation system)
CREATE TABLE IF NOT EXISTS vibe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  rater_id UUID REFERENCES members(id) NOT NULL,
  ratee_id UUID REFERENCES members(id) NOT NULL,
  ratee_role TEXT NOT NULL CHECK (ratee_role IN ('member', 'creator')),
  hospitality INTEGER CHECK (hospitality BETWEEN 1 AND 5),
  authenticity INTEGER CHECK (authenticity BETWEEN 1 AND 5),
  professionalism INTEGER CHECK (professionalism BETWEEN 1 AND 5),
  respect INTEGER CHECK (respect BETWEEN 1 AND 5),
  punctuality INTEGER CHECK (punctuality BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_members_handle ON members(handle);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_listings_creator_status ON listings(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_creator_status ON orders(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_auto_decline ON orders(status, auto_decline_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_vibe_ratings_order ON vibe_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_vibe_ratings_ratee ON vibe_ratings(ratee_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_ratings ENABLE ROW LEVEL SECURITY;

-- Members: users can read all profiles, insert and update only their own
CREATE POLICY "Public profiles are viewable by everyone" ON members
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON members
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON members
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Creators: public read, creator manages own
CREATE POLICY "Public creator profiles" ON creators
  FOR SELECT USING (true);

CREATE POLICY "Creator manages own profile" ON creators
  FOR ALL USING (auth.uid()::text = member_id::text);

-- Listings: public read for active, creator manages own
CREATE POLICY "Public active listings" ON listings
  FOR SELECT USING (status = 'active' OR creator_id IN (
    SELECT id FROM creators WHERE member_id::text = auth.uid()::text
  ));

CREATE POLICY "Creator manages own listings" ON listings
  FOR ALL USING (creator_id IN (
    SELECT id FROM creators WHERE member_id::text = auth.uid()::text
  ));

-- Orders: visible to involved parties
CREATE POLICY "Order parties can view" ON orders
  FOR SELECT USING (
    member_id::text = auth.uid()::text OR
    creator_id IN (SELECT id FROM creators WHERE member_id::text = auth.uid()::text)
  );

CREATE POLICY "Members can create orders" ON orders
  FOR INSERT WITH CHECK (member_id::text = auth.uid()::text);

CREATE POLICY "Creator can update own orders" ON orders
  FOR UPDATE USING (
    creator_id IN (SELECT id FROM creators WHERE member_id::text = auth.uid()::text)
  );

-- Messages: visible to sender and recipient
CREATE POLICY "Message parties can view" ON messages
  FOR SELECT USING (
    sender_id::text = auth.uid()::text OR
    recipient_id::text = auth.uid()::text
  );

CREATE POLICY "Authenticated users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id::text = auth.uid()::text);

CREATE POLICY "Recipient can mark read" ON messages
  FOR UPDATE USING (recipient_id::text = auth.uid()::text);

-- Vibe Ratings: visible to rater and ratee
CREATE POLICY "Rating parties can view" ON vibe_ratings
  FOR SELECT USING (
    rater_id::text = auth.uid()::text OR
    ratee_id::text = auth.uid()::text
  );

CREATE POLICY "Authenticated users can rate" ON vibe_ratings
  FOR INSERT WITH CHECK (rater_id::text = auth.uid()::text);

-- ============================================
-- REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ============================================
-- AUTO-DECLINE CRON (pg_cron)
-- ============================================
-- Note: pg_cron must be enabled in Supabase dashboard first
-- SELECT cron.schedule(
--   'auto-decline-orders',
--   '* * * * *',
--   $$
--     UPDATE orders
--     SET status = 'declined', updated_at = now()
--     WHERE status = 'pending'
--     AND auto_decline_at < now();
--   $$
-- );
