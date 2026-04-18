import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { checkRateLimit, OTP_REQUEST_LIMIT } from "@/lib/rate-limiter";

const US_PHONE_REGEX = /^\+1\d{10}$/;

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

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

    // Use Supabase Auth phone OTP
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      return apiError(
        error.message || "Failed to send code. Try again.",
        400
      );
    }

    return apiSuccess({ sent: true });
  } catch {
    return apiError("Failed to send code. Try again.", 500);
  }
}
