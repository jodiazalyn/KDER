/**
 * Beta signup webhook notifier.
 *
 * During the closed beta — while Twilio A2P 10DLC registration is in
 * flight and real SMS can't be delivered to non-test numbers — we still
 * want every signup attempt to capture a phone number we can manually
 * onboard. Each call to `notifyBetaSignup` fires an HTTPS POST to the
 * configured webhook with a Slack-compatible payload.
 *
 * Set `BETA_SIGNUP_WEBHOOK_URL` to:
 *   - A Slack incoming webhook → message arrives in your channel of choice
 *   - A Discord webhook → also accepts the `text` field via fallback
 *   - A Zapier / Make / Pipedream / n8n hook → route to email, Sheets, etc.
 *   - Any HTTPS endpoint that accepts POST application/json
 *
 * If the env var is unset (e.g. local dev), this is a quiet no-op — we
 * never want a misconfigured webhook to break the signup flow itself.
 *
 * Fire-and-forget: callers should NOT await this. The OTP send happens
 * regardless of webhook delivery.
 */

interface BetaSignupPayload {
  /** E.164 phone number (e.g. "+13234906633"). */
  phone: string;
  /** "creator" | "customer" | undefined — pulled from ?mode= on /signup. */
  mode?: string | null;
  /** "request-otp" or wherever the capture originated. */
  source: string;
  /** Reserved handle (creator-mode only). */
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

  // Slack-compatible payload. Slack/Discord/Zapier/etc. all accept
  // `text` (Slack) or fall back to readable JSON.
  const body = {
    text: `📱 KDER beta signup: ${payload.phone}${modeLabel}${handleLabel}${nameLabel} — ending …${phoneSuffix} at ${ts} via ${payload.source}`,
    // Structured fields so a Zapier-style consumer can route on them.
    phone: payload.phone,
    phoneSuffix,
    mode: payload.mode ?? null,
    handle: payload.handle ?? null,
    displayName: payload.displayName ?? null,
    source: payload.source,
    userAgent: payload.userAgent ?? null,
    timestamp: ts,
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
  }).catch((err) => {
    console.warn("[beta-signup-notifier] webhook delivery failed", err);
  });
}
