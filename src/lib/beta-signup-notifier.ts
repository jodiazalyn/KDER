/**
 * Beta signup webhook notifier.
 *
 * During the closed beta — while Twilio A2P 10DLC registration is in
 * flight and real SMS can't be delivered to non-test numbers — we still
 * want every signup attempt to fire a real-time ping so an operator can
 * manually onboard the would-be tester (add them to Supabase's
 * test-number list, DM them their OTP, etc.).
 *
 * Set `BETA_SIGNUP_WEBHOOK_URL` to:
 *   - A Slack incoming webhook → message arrives in your channel of choice
 *   - A Discord webhook → also accepts the `text` field via fallback
 *   - A Zapier / Make / Pipedream / n8n hook → route to email, Sheets, etc.
 *   - Any HTTPS endpoint that accepts POST application/json
 *
 * Slack incoming-webhook setup (the recommended path):
 *   1. https://api.slack.com/apps → Create New App → From scratch
 *   2. Pick a name (e.g. "KDER beta signups") + your workspace
 *   3. Sidebar → Incoming Webhooks → toggle on → Add New Webhook to
 *      Workspace → pick the destination channel (e.g. #kder-signups)
 *   4. Copy the URL it gives you (starts with
 *      https://hooks.slack.com/services/...) and paste into Netlify
 *      env vars as BETA_SIGNUP_WEBHOOK_URL.
 *
 * If the env var is unset (e.g. local dev), this is a quiet no-op —
 * we never want a misconfigured webhook to break the signup flow.
 *
 * Fire-and-forget: callers should NOT await this. The OTP send and
 * waitlist persistence happen regardless of webhook delivery.
 */

interface BetaSignupPayload {
  /** E.164 phone number (e.g. "+13234906633"). */
  phone: string;
  /** "creator" | "customer" | undefined — pulled from ?mode= on /signup. */
  mode?: string | null;
  /** "request-otp" | "beta/waitlist" — where the capture originated. */
  source: string;
  /** Reserved handle (creator-mode only, set on waitlist reservation). */
  handle?: string | null;
  /** Optional display name from the waitlist form. */
  displayName?: string | null;
  /** Optional — request user-agent for fingerprint context. */
  userAgent?: string | null;
}

export function notifyBetaSignup(payload: BetaSignupPayload): void {
  const url = process.env.BETA_SIGNUP_WEBHOOK_URL;
  if (!url) return;

  const phoneSuffix = payload.phone.slice(-4);
  const modeLabel = payload.mode ? ` (${payload.mode})` : "";
  const handleLabel = payload.handle ? ` @${payload.handle}` : "";
  const nameLabel = payload.displayName ? ` "${payload.displayName}"` : "";
  const ts = new Date().toISOString();

  // Onboarding hint: the exact string to paste into Supabase's Test
  // Phone Numbers list to activate this user with code 123456.
  const onboardHint = `${payload.phone.slice(1)}=123456`;

  // Slack-compatible payload. Slack/Discord/Zapier/etc. all accept
  // `text` (Slack) or fall back to readable JSON.
  const text = [
    `📱 *KDER beta signup*${modeLabel}${handleLabel}${nameLabel}`,
    `Phone: ${payload.phone} (…${phoneSuffix})`,
    `Source: ${payload.source} · ${ts}`,
    `Onboard: paste \`${onboardHint}\` into Supabase → Auth → Providers → Phone → Test Phone Numbers, then DM them \`123456\`.`,
  ].join("\n");

  const body = {
    text,
    // Structured fields so a Zapier-style consumer can route on them.
    phone: payload.phone,
    phoneSuffix,
    mode: payload.mode ?? null,
    handle: payload.handle ?? null,
    displayName: payload.displayName ?? null,
    source: payload.source,
    userAgent: payload.userAgent ?? null,
    timestamp: ts,
    onboardHint,
  };

  // Don't await — fire-and-forget so the signup flow stays fast even if
  // the webhook is slow or down. The catch handler keeps a missing
  // webhook from emitting noisy unhandled-rejection warnings.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Short timeout via AbortController — webhook should never block us.
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `[beta-signup-notifier] webhook returned ${res.status} phoneSuffix=${phoneSuffix}`
        );
      } else {
        console.log(
          `[beta-signup-notifier] sent ok phoneSuffix=${phoneSuffix}`
        );
      }
    })
    .catch((err) => {
      console.warn("[beta-signup-notifier] webhook delivery failed", err);
    });
}
