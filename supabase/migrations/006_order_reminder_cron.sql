-- 006_order_reminder_cron.sql
--
-- Schedules the reminder sweep (src/app/api/v1/cron/order-reminders)
-- via Supabase pg_cron + pg_net. Runs every 5 minutes; the route
-- itself enforces auth via the CRON_SECRET bearer token.
--
-- Setup steps (one-time, in the Supabase dashboard):
--   1. Database → Extensions → enable `pg_cron` and `pg_net`
--      (already enabled on most newer projects)
--   2. Database → Settings → Custom Postgres Config, add:
--        app.cron_url     = https://<your-domain>/api/v1/cron/order-reminders
--        app.cron_secret  = <the same value as CRON_SECRET in your app env>
--   3. Run this migration
--
-- To verify it's scheduled:
--   SELECT * FROM cron.job WHERE jobname = 'order-reminder-sweep';
-- To see recent runs:
--   SELECT * FROM cron.job_run_details
--   WHERE jobname = 'order-reminder-sweep'
--   ORDER BY start_time DESC LIMIT 20;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent re-schedule: drop any prior copy of this job, then create
-- it fresh. Safe to re-run when the URL or secret changes.
SELECT cron.unschedule('order-reminder-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'order-reminder-sweep');

SELECT cron.schedule(
  'order-reminder-sweep',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.cron_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
