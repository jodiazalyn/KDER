/**
 * SendGrid transactional email wrapper.
 *
 * Mirrors the `sendSms()` pattern in `./twilio.ts`: silent no-op when
 * credentials are missing, best-effort delivery when configured.
 * Never throws — callers shouldn't have to wrap every notification
 * in try/catch.
 *
 * Required env vars (see `.env.local.example`):
 *   - SENDGRID_API_KEY        — full API key
 *   - SENDGRID_FROM_EMAIL     — verified sender (DNS-authenticated for prod)
 *   - SENDGRID_FROM_NAME      — display name
 */

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Custom SMTP headers — used for threading via Message-ID / In-Reply-To. */
  headers?: Record<string, string>;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return !!(
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_FROM_EMAIL
  );
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    console.log("[SendGrid] Not configured — skipping email to", args.to);
    return { success: true, messageId: "demo_skipped" };
  }

  const apiKey = process.env.SENDGRID_API_KEY!;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL!;
  const fromName = process.env.SENDGRID_FROM_NAME ?? "KDER";

  // Strip HTML tags for the plain-text fallback when caller doesn't provide one.
  const text =
    args.text ??
    args.html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: fromEmail, name: fromName },
        ...(args.replyTo ? { reply_to: { email: args.replyTo } } : {}),
        subject: args.subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: args.html },
        ],
        ...(args.headers && Object.keys(args.headers).length > 0
          ? { headers: args.headers }
          : {}),
      }),
    });

    if (!res.ok) {
      // SendGrid returns 4xx with a JSON body listing errors.
      const body = await res.text();
      console.error("[SendGrid] Send failed:", res.status, body);
      return { success: false, error: `SendGrid ${res.status}: ${body}` };
    }

    // SendGrid returns 202 Accepted with the message id in the X-Message-Id header.
    const messageId = res.headers.get("x-message-id") ?? undefined;
    return { success: true, messageId };
  } catch (err) {
    console.error("[SendGrid] Send threw:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
