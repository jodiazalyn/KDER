-- 020_members_email_only_checkout
-- Phase 2.2 of the Uber Direct rollout — frictionless guest
-- checkout. Customers can now provide phone OR email (one
-- notification channel) on PICKUP orders; delivery still requires
-- phone upstream because Uber's courier needs a number to reach
-- the customer at the door.
--
-- Two changes:
--   1. Drop the NOT NULL on members.phone — was a holdover from
--      when every onboarding path collected phone first. The
--      anonymous-customer route now writes a members row with
--      either phone, email, or both depending on what the
--      customer typed.
--   2. Add a CHECK constraint that requires at least one
--      contact channel per member, so we don't silently end up
--      with members rows that have neither a phone nor an email
--      (which would leave the creator unable to follow up about
--      an order).
--
-- Idempotent, no backfill needed:
--   - Legacy members rows all already have a non-null phone (the
--     prior schema enforced it), so they pass the new CHECK
--     vacuously.
--   - The constraint is added VALID (not NOT VALID) precisely so
--     that future inserts/updates are checked AND we get a
--     compile-time guarantee for the existing rows. Postgres
--     scans the table once on add; on the ~thousands-of-rows
--     scale we operate at this is sub-second.

ALTER TABLE members ALTER COLUMN phone DROP NOT NULL;

-- Belt-and-suspenders: every members row needs at least one way
-- to be reached. The API enforces this at the input layer; this
-- catches any future code path that forgets.
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_contact_required;
ALTER TABLE members
  ADD CONSTRAINT members_contact_required
  CHECK (phone IS NOT NULL OR email IS NOT NULL);

COMMENT ON CONSTRAINT members_contact_required ON members IS
  'Phase 2.2 (Uber Direct) — members must have phone OR email so '
  'order updates can always be delivered. Delivery orders enforce '
  'phone specifically at the API layer (Uber courier requirement).';
