-- ============================================================
-- 016 — Catering: service style on inquiries + tagged fee items on quotes
-- ============================================================
-- Adds the "Full Service vs Drop-Off" question to the customer
-- inquiry form, then makes the creator's quote-builder fees a
-- structured list of tagged line items (Server / Delivery / Setup /
-- Warming / Custom) instead of a single opaque dollar amount.
--
-- Why:
--   The previous quote builder collapsed every fee into one
--   "Fees" number, which made it impossible for the customer to
--   tell what they were paying for. Worse, the available fee types
--   depend on the service style — drop-off catering has no server
--   but may need a warming fee for burners — and the creator was
--   on the honor system to compose them correctly.
--
-- Back-compat:
--   * `service_style` is nullable on `catering_inquiries` — every
--     pre-016 inquiry stays valid (the UI defaults missing values
--     to "full_service" since that's the historical assumption).
--   * `fee_items` defaults to '[]' on `catering_quotes`. The
--     existing `fees_cents` column stays as the computed sum so
--     payment math + downstream cron jobs don't need to change.
--     New code writes both; old quotes still render their flat
--     `fees_cents` line on the customer review page.
-- ============================================================

-- ── catering_inquiries.service_style ─────────────────────────
ALTER TABLE catering_inquiries
  ADD COLUMN IF NOT EXISTS service_style text
    CHECK (
      service_style IS NULL OR
      service_style IN ('full_service', 'drop_off')
    );

COMMENT ON COLUMN catering_inquiries.service_style IS
  'Customer-picked service mode. full_service = creator brings staff '
  '(server + delivery + setup). drop_off = no staff on site; food is '
  'delivered fresh and warming fee may apply. NULL on pre-016 rows.';

-- ── catering_quotes.fee_items ────────────────────────────────
-- JSONB array of:
--   [{ tag: 'server'|'delivery'|'setup'|'warming'|'custom',
--      label: string,
--      amount_cents: int,
--      shift_end_time?: 'HH:MM'   -- only on tag = 'server'
--    }, ...]
-- `fees_cents` stays as sum(fee_items[].amount_cents). New code
-- writes both for atomicity.
ALTER TABLE catering_quotes
  ADD COLUMN IF NOT EXISTS fee_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN catering_quotes.fee_items IS
  'Structured fee breakdown. Each row: {tag, label, amount_cents, '
  'shift_end_time?}. tag drives both the customer-visible category '
  'pill and the available extras (e.g. shift_end_time on server). '
  'fees_cents is kept in sync as the sum for payment math.';
