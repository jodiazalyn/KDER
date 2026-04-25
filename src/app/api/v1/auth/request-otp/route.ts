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

    // Rate limit: 5 OTP requests per phone per 10 minutes
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

    // Beta-window capture: notify the configured webhook (Slack, Discord,
    // Zapier, email forwarder, etc.) BEFORE attempting the OTP send. While
    // A2P 10DLC registration is in flight we can't deliver real SMS to most
    // numbers, so the webhook is how we collect tester phones to manually
    // onboard via Supabase's test-number list. Fire-and-forget — never
    // blocks the OTP send and never errors out the request even if the
    // webhook URL is down.
    notifyBetaSignup({
      phone: cleanPhone,
      mode: typeof mode === "string" ? mode : null,
      source: "request-otp",
      userAgent: request.headers.get("user-agent"),
    });

    // Use Supabase Auth phone OTP
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({ phone });
    const phoneSuffix = cleanPhone.slice(-4);

    if (error) {
      // Surface the full Supabase error context to logs. Without this we
      // could never tell why an OTP failed to send (Twilio A2P 10DLC,
      // trial-mode account, geo-perms, etc. all surface here).
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
