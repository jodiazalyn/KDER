import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";
import { checkRateLimit, OTP_VERIFY_LIMIT } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !String(phone).trim() || !code || !String(code).trim()) {
      return apiError("Phone and code are required.", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanCode = String(code).trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return apiError("Incorrect code. Try again.", 400);
    }

    // Rate limit: 10 verify attempts per phone per 10 minutes
    const limit = checkRateLimit(
      `otp_verify:${cleanPhone}`,
      OTP_VERIFY_LIMIT.maxRequests,
      OTP_VERIFY_LIMIT.windowMs
    );
    if (!limit.allowed) {
      const retryMin = Math.ceil(limit.retryAfterMs / 60000);
      return apiError(
        `Too many attempts. Try again in ${retryMin} minute${retryMin > 1 ? "s" : ""}.`,
        429
      );
    }

    // Demo mode — accept any 6-digit code
    if (isDemoMode()) {
      return apiSuccess({ verified: true, isNewUser: true, demo: true });
    }

    // Production: verify with Supabase Auth
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (error || !data.user) {
      return apiError("Incorrect code. Try again.", 400);
    }

    // Check if user already has a member profile
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("id", data.user.id)
      .single();

    return apiSuccess({
      verified: true,
      isNewUser: !member,
    });
  } catch {
    return apiError("Verification failed. Check your connection and try again.", 500);
  }
}
