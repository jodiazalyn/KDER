import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { checkRateLimit, OTP_REQUEST_LIMIT } from "@/lib/rate-limiter";
import { notifyBetaSignup } from "@/lib/beta-signup-notifier";

const US_PHONE_REGEX = /^\+1\d{10}$/;

export async function POST(request: NextRequest) {
  try {
    const { phone, mode } = await request.json();

    if (!phone || !String(phone).trim()) return apiError("Phone number is required.", 400);
    const cleanPhone = String(phone).trim();
    if (!US_PHONE_REGEX.test(cleanPhone)) {
      return apiError("Enter a valid US phone number.", 400);
    }

    // App-level rate limit: 5 OTP requests per phone per 10 minutes.
    // Twilio Verify enforces its own server-side limits (5 sends per
    // recipient per 10min plus a daily ceiling), so this is mostly a
    // defense-in-depth fast-path 429 — bouncing the obvious abuse before
    // we even reach Supabase/Twilio.
    const limit = checkRateLimit(
      `otp_request:${cleanPhone}`,
      OTP_REQUEST_LIMIT.maxRequests,
      OTP_REQUEST_LIMIT.windowMs
    );
    if (!limit.allowed) {
      const retryMin = Math.ceil(limit.retryAfterMs / 60000);
      return apiError(
        `Too many requests. Try again in ${retryMin} minute${retryMin > 1 ? "s" : ""}.`,
        429
      );
    }

    // Operational telemetry: notify the configured webhook (Slack, Discord,
    // Zapier, email forwarder, etc.) BEFORE attempting the OTP send so an
    // operator has real-time visibility into who's signing up. Originally
    // added during the A2P 10DLC wait as a workaround for blocked SMS
    // delivery — now that OTPs route through Twilio Verify (10DLC-exempt),
    // this is just visibility / audit trail. Fire-and-forget — never blocks
    // the OTP send and never errors out the request even if the webhook
    // URL is down.
    notifyBetaSignup({
      phone: cleanPhone,
      mode: typeof mode === "string" ? mode : null,
      source: "request-otp",
      userAgent: request.headers.get("user-agent"),
    });

    // Supabase Auth phone OTP. Supabase is configured (via dashboard:
    // Authentication → Providers → Phone) to use Twilio Verify as its SMS
    // backend, so the actual `verifications.create` call to Twilio happens
    // inside Supabase. We get back the same response shape regardless.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({ phone });
    const phoneSuffix = cleanPhone.slice(-4);

    if (error) {
      // Surface the full Supabase error context to logs. Common Verify
      // failure modes that bubble up here:
      //   - sms_send_failed: catch-all from Verify (check phoneSuffix
      //     against Twilio Verify logs for the underlying reason)
      //   - over_phone_send_rate_limit: Verify's per-recipient cap
      //     (stricter than ours; user just needs to wait)
      //   - phone_provider_disabled: Supabase phone provider config
      //     missing/wrong (Verify Service SID typo, etc.)
      //   - invalid_format: phone failed Verify's E.164 parse
      // Last 4 digits only — full phone is PII.
      const code = (error as { code?: string }).code;
      console.error("[auth/request-otp] supabase signInWithOtp failed", {
        code,
        status: error.status,
        name: error.name,
        message: error.message,
        phoneSuffix,
      });
      return apiError(
        error.message || "Failed to send code. Try again.",
        error.status ?? 400,
        { code }
      );
    }

    console.log(`[auth/request-otp] sent ok phoneSuffix=${phoneSuffix}`);
    return apiSuccess({ sent: true });
  } catch (err) {
    console.error("[auth/request-otp] unexpected exception", err);
    return apiError("Failed to send code. Try again.", 500);
  }
}
