-- ============================================================
-- 015 — Pricing-agent chat persistence
-- ============================================================
-- Stores AI pricing-coach conversations for signed-in creators so
-- they can come back and re-read or continue. Anonymous chats never
-- touch this table (they live in component state).
--
-- The whole transcript ships as a JSONB blob so we can extend the
-- shape later (recipe attachments, saved pricing calcs) without
-- another schema migration. Shape:
--   [
--     { role: 'user',      content: 'I have rice + chicken thighs' },
--     { role: 'assistant', content: '...', tool_uses?: [...] }
--   ]
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- First 40 chars of the user's opening message — used as the
  -- list-item label so creators can find a chat in the past-chats
  -- drawer.
  title text NOT NULL,

  messages jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path: render the past-chats drawer for a given member, newest
-- first.
CREATE INDEX IF NOT EXISTS idx_pricing_chats_member
  ON pricing_chats (member_id, updated_at DESC);

ALTER TABLE pricing_chats ENABLE ROW LEVEL SECURITY;

-- A creator can only see their own chats.
CREATE POLICY "Member reads own chats"
  ON pricing_chats FOR SELECT USING (
    member_id::text = auth.uid()::text
  );

CREATE POLICY "Member inserts own chats"
  ON pricing_chats FOR INSERT TO authenticated
  WITH CHECK (member_id::text = auth.uid()::text);

CREATE POLICY "Member updates own chats"
  ON pricing_chats FOR UPDATE USING (
    member_id::text = auth.uid()::text
  );
