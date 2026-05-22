-- 007_members_email.sql
--
-- Adds an `email` column to `members` so order-event notifications
-- (notifyOrderPlaced, notifyOrderReminder) can reach creators.
--
-- Background: signup is phone-OTP only — Supabase Auth users have no
-- email field for our creators. Order notification routes were assuming
-- a member.email join that didn't exist; the join silently returned
-- null and emails to creators were dropped before they ever hit
-- SendGrid. Email is now collected at onboarding (required) and
-- editable in /settings.
--
-- The column is nullable because:
--   1. Existing creators (pre-this-migration) have no email yet —
--      the dashboard surfaces a "Add your email" banner to backfill.
--   2. Customer-side `members` rows created via the anon-checkout flow
--      legitimately have no email.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Lookup index for any future "find member by email" use cases (e.g.,
-- support tooling, dedupe). Cheap; partial since most rows will have
-- an email going forward but historical rows will be null for a while.
CREATE INDEX IF NOT EXISTS idx_members_email
  ON members (LOWER(email))
  WHERE email IS NOT NULL;
