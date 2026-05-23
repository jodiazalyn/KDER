-- ============================================================
-- 011 — Catering inquiries
-- ============================================================
-- PR 2 of the catering feature. Adds the inquiry table — the customer-
-- to-creator request that kicks off a catering quote conversation.
--
-- An inquiry is just intent. It captures everything the creator needs
-- to think about the job and reply with a quote: who, when, where,
-- how many, what they want, dietary notes, special requirements.
--
-- An inquiry becomes a `catering_quote` (PR 3) once the creator sends
-- a quote in reply. The inquiry → quote → booking flow keeps the
-- intent / quote / commitment as separate first-class records so
-- analytics, status, and edits are clean.
--
-- Messages between creator and customer ride the existing `messages`
-- table (order_id is already nullable, so a member-to-member message
-- works fine). PR 3 will add catering_inquiry_id + catering_quote_id
-- columns to messages so threads can be scoped properly and quote
-- cards can be pinned inline.
-- ============================================================

CREATE TABLE IF NOT EXISTS catering_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id)  ON DELETE CASCADE,

  -- Event basics — all required, the form enforces them.
  event_date    date NOT NULL,
  event_time    time,
  event_end_time time,
  guest_count   int  NOT NULL CHECK (guest_count > 0),

  -- Location + venue context
  event_address     text,                       -- nullable: pickup-only jobs may skip
  event_venue_type  text CHECK (event_venue_type IS NULL OR event_venue_type IN ('residence', 'venue', 'other')),
  indoor_outdoor    text CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'mixed')),

  -- Setup logistics (matters for on-site / delivered jobs)
  needs_server       boolean DEFAULT false,
  needs_setup        boolean DEFAULT false,
  earliest_setup_time time,
  kitchen_available  boolean,

  -- Customer-facing context
  allergies text,
  notes     text,

  -- Pre-selected items from the customer's menu browse — gives the
  -- creator a one-click conversion to a quote draft.
  pre_selected_listing_ids uuid[] DEFAULT '{}',

  -- Lifecycle: open → quoted (creator sent a quote) → booked (deposit
  -- paid) → declined (creator declined) → expired (no quote within X days)
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'quoted', 'booked', 'declined', 'expired')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path for the creator inbox: "open + quoted inquiries for me,
-- newest first".
CREATE INDEX IF NOT EXISTS idx_catering_inquiries_creator_status
  ON catering_inquiries (creator_id, status, created_at DESC);

-- Customer side: "show me my recent inquiries"
CREATE INDEX IF NOT EXISTS idx_catering_inquiries_member
  ON catering_inquiries (member_id, created_at DESC);

ALTER TABLE catering_inquiries ENABLE ROW LEVEL SECURITY;

-- Both parties can read. Creator scoped via their creators row;
-- customer scoped directly via member_id.
CREATE POLICY "Inquiry parties can read"
  ON catering_inquiries FOR SELECT USING (
    member_id::text = auth.uid()::text OR
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );

-- Customers create inquiries. The form sends member_id = auth.uid().
CREATE POLICY "Member creates own inquiry"
  ON catering_inquiries FOR INSERT TO authenticated
  WITH CHECK (member_id::text = auth.uid()::text);

-- Both parties can update — but typical use is creator-only (status,
-- notes). Tighten in a later PR if abuse appears.
CREATE POLICY "Inquiry parties can update"
  ON catering_inquiries FOR UPDATE USING (
    member_id::text = auth.uid()::text OR
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );
