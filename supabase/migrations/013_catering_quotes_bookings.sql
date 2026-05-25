-- ============================================================
-- 013 — Catering quotes & bookings
-- ============================================================
-- PR 3 of the catering feature. Wires up the inquiry → quote →
-- deposit → booking flow.
--
-- Flow:
--   1. Customer submits inquiry (PR 2 — catering_inquiries.status='open')
--   2. Creator builds a quote (line items + fees + expiration), sends it
--      → new catering_quotes row, inquiry.status='quoted'
--   3. Customer reviews on /catering/quote/[id] and pays the 30% deposit
--      → Stripe PaymentIntent succeeds with metadata.type='catering_deposit'
--      → webhook creates catering_bookings row, status='pending_acceptance'
--   4. Creator gets 4h to accept or decline the booking
--      → accept: status='confirmed', schedule balance auto-charge
--      → decline (or timeout): status='cancelled', refund deposit
--   5. Balance auto-charge X days before event (PR 4)
-- ============================================================

-- ── catering_quotes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid NOT NULL REFERENCES catering_inquiries(id) ON DELETE CASCADE,
  creator_id  uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id)  ON DELETE CASCADE,

  -- Line items as JSONB: [{name, qty, unit_price_cents, total_cents,
  -- listing_id?}, ...]. listing_id is optional — creators add custom
  -- line items that don't tie to a published catering listing.
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Money. All in cents to avoid float drift.
  --   food_subtotal_cents = sum of line items
  --   fees_cents          = delivery, labor, server, setup (NOT in deposit)
  --   tax_cents           = optional tax row (creator-set)
  --   total_cents         = food_subtotal + fees + tax
  --   deposit_cents       = 30% of food_subtotal_cents (rounded)
  --   balance_cents       = total - deposit
  food_subtotal_cents int NOT NULL CHECK (food_subtotal_cents >= 0),
  fees_cents          int NOT NULL DEFAULT 0 CHECK (fees_cents >= 0),
  tax_cents           int NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents         int NOT NULL CHECK (total_cents >= 0),
  deposit_cents       int NOT NULL CHECK (deposit_cents >= 0),
  balance_cents       int NOT NULL CHECK (balance_cents >= 0),

  -- Optional notes the creator wants the customer to see alongside the
  -- itemized breakdown.
  creator_notes text,

  expires_at  timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN (
    'draft',       -- creator is still editing (not in v1, reserved)
    'sent',        -- delivered to customer, awaiting deposit
    'accepted',    -- customer paid the deposit
    'declined',    -- customer explicitly declined
    'expired',     -- past expires_at without a payment
    'superseded'   -- creator sent a new quote replacing this one
  )),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for the expiry sweep cron — "any sent quotes that
-- expired before now?"
CREATE INDEX IF NOT EXISTS idx_catering_quotes_status_expires
  ON catering_quotes (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_catering_quotes_inquiry
  ON catering_quotes (inquiry_id, created_at DESC);

ALTER TABLE catering_quotes ENABLE ROW LEVEL SECURITY;

-- Both parties read. Customer needs read access for the standalone
-- /catering/quote/[id] page; creator needs it for the inquiry detail.
CREATE POLICY "Quote parties can read"
  ON catering_quotes FOR SELECT USING (
    member_id::text = auth.uid()::text OR
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );

-- Only the creator builds quotes. Customer can't insert a quote on
-- their own behalf.
CREATE POLICY "Creator builds quotes"
  ON catering_quotes FOR INSERT TO authenticated
  WITH CHECK (
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );

-- Creator can update their own quotes (e.g., resend with new expiry).
-- Customer-side actions (decline, mark-paid) go through service-role
-- API routes so RLS doesn't need a customer-update policy.
CREATE POLICY "Creator updates own quotes"
  ON catering_quotes FOR UPDATE USING (
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );

-- ── catering_bookings ───────────────────────────────────────
-- The "order" once the deposit is paid. Tracks the booking through
-- the event lifecycle and holds the saved payment method for the
-- off-session balance charge in PR 4.
CREATE TABLE IF NOT EXISTS catering_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES catering_quotes(id),
  inquiry_id  uuid NOT NULL REFERENCES catering_inquiries(id),
  creator_id  uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id)  ON DELETE CASCADE,

  -- Snapshot of event date/time at booking time (in case the inquiry
  -- ever gets mutated). Source of truth for the balance-charge cron.
  event_date  date NOT NULL,
  event_time  time,

  status text NOT NULL DEFAULT 'pending_acceptance' CHECK (status IN (
    'pending_acceptance', -- deposit paid, awaiting creator accept (4h window)
    'confirmed',          -- creator accepted, awaiting balance + event
    'balance_due',        -- balance charge failed, needs manual retry
    'balance_paid',       -- balance successfully charged
    'completed',          -- event has happened
    'cancelled'           -- creator declined OR auto-declined OR customer cancelled
  )),

  -- Money snapshot from the quote at acceptance time so the booking
  -- doesn't drift if the quote row ever changes.
  total_cents   int NOT NULL CHECK (total_cents >= 0),
  deposit_cents int NOT NULL CHECK (deposit_cents >= 0),
  balance_cents int NOT NULL CHECK (balance_cents >= 0),

  -- Stripe handles
  stripe_customer_id            text,        -- so future off-session charges have the customer
  deposit_payment_intent_id     text NOT NULL,
  deposit_paid_at               timestamptz NOT NULL,
  balance_payment_method_id     text,        -- saved card from SetupIntent for the balance
  balance_payment_intent_id     text,
  balance_charged_at            timestamptz,
  balance_charge_scheduled_for  timestamptz, -- set on creator-accept (PR 4 fills this in)

  accept_deadline timestamptz,                -- pending_acceptance auto-declines after this
  cancellation_reason text,                   -- audit trail for declines / auto-declines

  notes_for_creator text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path for the acceptance-deadline cron: "any bookings stuck in
-- pending_acceptance past their accept_deadline?"
CREATE INDEX IF NOT EXISTS idx_catering_bookings_accept_deadline
  ON catering_bookings (accept_deadline)
  WHERE status = 'pending_acceptance';

-- Hot path for the balance-charge cron (PR 4).
CREATE INDEX IF NOT EXISTS idx_catering_bookings_balance_schedule
  ON catering_bookings (balance_charge_scheduled_for)
  WHERE status = 'confirmed' AND balance_charged_at IS NULL;

-- Creator dashboard listing all their bookings sorted by event date.
CREATE INDEX IF NOT EXISTS idx_catering_bookings_creator_event
  ON catering_bookings (creator_id, event_date DESC);

ALTER TABLE catering_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can read"
  ON catering_bookings FOR SELECT USING (
    member_id::text = auth.uid()::text OR
    creator_id IN (
      SELECT id FROM creators WHERE member_id::text = auth.uid()::text
    )
  );

-- All booking inserts and updates go through service-role API routes
-- (webhook, accept/decline endpoints, cron sweeps) — RLS doesn't need
-- write policies for end-users.
