-- ============================================
-- WAITLIST SIGNUPS (idempotent — safe to re-run)
-- Captures phone + handle for creators signing up while Twilio A2P 10DLC
-- registration is pending. Reserves the handle so when we manually
-- onboard a tester via Supabase's test-number list, their handle is
-- guaranteed available.
-- ============================================

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  -- handle is required for creator-mode signups, NULL for customer-mode
  handle TEXT UNIQUE,
  display_name TEXT,
  -- "creator" | "customer" — drives which downstream flow we activate them into
  mode TEXT NOT NULL DEFAULT 'creator',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'activated', 'declined')),
  notes TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON waitlist_signups(phone);
CREATE INDEX IF NOT EXISTS idx_waitlist_handle ON waitlist_signups(handle)
  WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_signups(status);

-- Lowercase enforcement on handle so the unique constraint works
-- regardless of what the client submits.
CREATE OR REPLACE FUNCTION lowercase_waitlist_handle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.handle IS NOT NULL THEN
    NEW.handle := lower(NEW.handle);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waitlist_signups_lowercase_handle ON waitlist_signups;
CREATE TRIGGER waitlist_signups_lowercase_handle
  BEFORE INSERT OR UPDATE ON waitlist_signups
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_waitlist_handle();

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (anon, public signup) — uniqueness constraints + the
-- API route's validation are the integrity layer here.
DROP POLICY IF EXISTS "anon insert waitlist" ON waitlist_signups;
CREATE POLICY "anon insert waitlist" ON waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No public reads. Admin / service role reads via dashboard or future
-- admin UI only. Prevents handle-squatting recon attacks.
DROP POLICY IF EXISTS "service role full access" ON waitlist_signups;
CREATE POLICY "service role full access" ON waitlist_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
