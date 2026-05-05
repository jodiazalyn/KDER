-- 006_order_reminder_cron.sql
--
-- Schedules the reminder sweep (src/app/api/v1/cron/order-reminders)
-- via Supabase pg_cron + pg_net. Runs every 5 minutes; the route
-- itself enforces auth via the CRON_SECRET bearer token.
--
-- Note on secret storage: Supabase doesn't allow setting arbitrary
-- `app.*` Postgres settings (rejected with "ERROR 42501: permission
-- denied to set parameter"), so the CRON_SECRET lives in Supabase
-- Vault instead and is read at execution time. The cron URL is
-- public information and inlined directly.
--
-- Setup steps (one-time, in the Supabase dashboard):
--   1. Database → Extensions → enable `pg_cron`, `pg_net`, `supabase_vault`
--      (all enabled by default on newer projects)
--   2. Database → Vault → New Secret:
--        Name:  cron_secret
--        Value: <the same value as CRON_SECRET in your Netlify env>
--   3. Run this migration
--
-- If the deployed cron URL ever changes (custom domain, etc.), update
-- the inline URL below and re-run this migration.
--
-- To verify it's scheduled:
--   SELECT * FROM cron.job WHERE jobname = 'order-reminder-sweep';
-- To see recent runs:
--   SELECT start_time, status, return_message
--   FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'order-reminder-sweep')
--   ORDER BY start_time DESC LIMIT 20;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Idempotent re-schedule: drop any prior copy of this job, then create
-- it fresh. Safe to re-run when the URL or Vault secret name changes.
SELECT cron.unschedule('order-reminder-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'order-reminder-sweep');

SELECT cron.schedule(
  'order-reminder-sweep',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://kder.club/api/v1/cron/order-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
          LIMIT 1
        ),
        'Content-Type', 'application/json'
      )
    );
  $$
);
