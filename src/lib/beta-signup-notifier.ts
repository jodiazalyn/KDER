import { Resend } from "resend";

/**
 * Beta signup email notifier.
 *
 * During the closed beta — while Twilio A2P 10DLC registration is in
 * flight and real SMS can't be delivered to non-test numbers — every
 * signup attempt fires a notification email so an operator can manually
 * onboard the would-be tester (add them to Supabase's test-number list,
 * DM them their OTP, etc.).
 *
 * Required env:
 *   - RESEND_API_KEY
 *
 * Optional env (with sensible defaults):
 *   - BETA_SIGNUP_EMAIL_TO    (default: admin@kder.org)
 *   - BETA_SIGNUP_EMAIL_FROM  (default: notifications@kder.org)
 *
 * Until kder.org is verified as a sender domain in Resend, set
 * BETA_SIGNUP_EMAIL_FROM to "onboarding@resend.dev" so emails actually
 * leave Resend. Once the domain is verified, switch back to
 * notifications@kder.org for branded sender visibility.
 *
 * If RESEND_API_KEY is unset (e.g. local dev without secrets), this is
 * a quiet no-op — we never want a misconfigured email pipeline to break
 * the signup flow itself.
 *
 * Fire-and-forget: callers should NOT await this. The OTP send and
 * waitlist persistence happen regardless of email delivery.
 */

interface BetaSignupPayload {
  /** E.164 phone number (e.g. "+13234906633"). */
  phone: string;
  /** "creator" | "customer" | undefined — pulled from ?mode= on /signup. */
  mode?: string | null;
  /** "request-otp" | "beta/waitlist" — where the capture originated. */
  source: string;
  /** Reserved handle (creator-mode only, set on the waitlist reservation). */
  handle?: string | null;
  /** Optional display name from the waitlist form. */
  displayName?: string | null;
  /** Optional — request user-agent for fingerprint context. */
  userAgent?: string | null;
}

let cachedResend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (cachedResend) return cachedResend;
  cachedResend = new Resend(apiKey);
  return cachedResend;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSubject(p: BetaSignupPayload): string {
  const role = p.mode === "customer" ? "customer" : "creator";
  const handlePart = p.handle ? ` @${p.handle}` : "";
  return `New KDER beta signup: ${role}${handlePart} (${p.phone})`;
}

function buildHtml(p: BetaSignupPayload, ts: string): string {
  const phone = escapeHtml(p.phone);
  const phoneSuffix = p.phone.slice(-4);
  const mode = escapeHtml(p.mode ?? "(unset)");
  const source = escapeHtml(p.source);
  const handleRow = p.handle
    ? `<tr><td style="padding:6px 12px;color:#666"><strong>Handle</strong></td><td style="padding:6px 12px">@${escapeHtml(
        p.handle
      )}</td></tr>`
    : "";
  const nameRow = p.displayName
    ? `<tr><td style="padding:6px 12px;color:#666"><strong>Display name</strong></td><td style="padding:6px 12px">${escapeHtml(
        p.displayName
      )}</td></tr>`
    : "";
  const uaRow = p.userAgent
    ? `<tr><td style="padding:6px 12px;color:#666"><strong>User agent</strong></td><td style="padding:6px 12px;font-family:monospace;font-size:11px">${escapeHtml(
        p.userAgent
      )}</td></tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
      <div style="background:#1B5E20;color:#fff;padding:16px 20px;font-size:16px;font-weight:700">
        📱 New KDER beta signup
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 12px;color:#666;width:140px"><strong>Phone</strong></td><td style="padding:6px 12px"><a href="tel:${phone}" style="color:#1B5E20">${phone}</a> <span style="color:#999">(…${phoneSuffix})</span></td></tr>
        <tr><td style="padding:6px 12px;color:#666"><strong>Mode</strong></td><td style="padding:6px 12px">${mode}</td></tr>
        ${handleRow}
        ${nameRow}
        <tr><td style="padding:6px 12px;color:#666"><strong>Source</strong></td><td style="padding:6px 12px">${source}</td></tr>
        <tr><td style="padding:6px 12px;color:#666"><strong>Captured</strong></td><td style="padding:6px 12px">${escapeHtml(ts)}</td></tr>
        ${uaRow}
      </table>
      <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#666">
        To onboard them: paste <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e5e5e5">${phone.slice(
          1
        )}=123456</code> into Supabase → Auth → Providers → Phone → Test Phone Numbers, then DM them the code <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e5e5e5">123456</code>.
      </div>
    </div>
  </body>
</html>`;
}

function buildText(p: BetaSignupPayload, ts: string): string {
  const lines = [
    `New KDER beta signup`,
    ``,
    `Phone:        ${p.phone}`,
    `Mode:         ${p.mode ?? "(unset)"}`,
    p.handle ? `Handle:       @${p.handle}` : null,
    p.displayName ? `Display name: ${p.displayName}` : null,
    `Source:       ${p.source}`,
    `Captured:     ${ts}`,
    p.userAgent ? `User agent:   ${p.userAgent}` : null,
    ``,
    `To onboard: paste ${p.phone.slice(
      1
    )}=123456 into Supabase Auth → Providers → Phone → Test Phone Numbers, then DM them the code 123456.`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function notifyBetaSignup(payload: BetaSignupPayload): void {
  const resend = getResend();
  if (!resend) {
    // Quiet no-op when secrets aren't configured (e.g. local dev). We
    // intentionally do NOT throw — signup flow stays alive even if the
    // notification layer is broken.
    return;
  }

  const to = process.env.BETA_SIGNUP_EMAIL_TO || "admin@kder.org";
  const from = process.env.BETA_SIGNUP_EMAIL_FROM || "notifications@kder.org";
  const ts = new Date().toISOString();

  // Don't await — fire-and-forget so the API route returns fast even
  // if Resend is slow. The .catch handler keeps an unhandled rejection
  // from leaking into Next's logs as a scary-looking error.
  resend.emails
    .send({
      from,
      to,
      subject: buildSubject(payload),
      html: buildHtml(payload, ts),
      text: buildText(payload, ts),
    })
    .then((res) => {
      if (res.error) {
        console.warn("[beta-signup-notifier] resend rejected", {
          error: res.error,
          to,
          phoneSuffix: payload.phone.slice(-4),
        });
      } else {
        console.log(
          `[beta-signup-notifier] sent ok id=${res.data?.id ?? "?"} phoneSuffix=${payload.phone.slice(-4)}`
        );
      }
    })
    .catch((err) => {
      console.warn("[beta-signup-notifier] email delivery failed", err);
    });
}
