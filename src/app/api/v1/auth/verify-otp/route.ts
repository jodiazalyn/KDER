import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
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

    // Verify with Supabase Auth
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    const phoneSuffix = cleanPhone.slice(-4);

    if (error || !data.user) {
      // Surface the verify failure too. Most common codes here:
      //   otp_expired (60s expiry), otp_disabled, invalid_otp.
      // Last 4 digits only — full phone is PII.
      const errCode = error
        ? (error as { code?: string }).code
        : undefined;
      console.error("[auth/verify-otp] supabase verifyOtp failed", {
        code: errCode,
        status: error?.status,
        name: error?.name,
        message: error?.message,
        hasUser: !!data?.user,
        phoneSuffix,
      });
      return apiError("Incorrect code. Try again.", 400, { code: errCode });
    }

    // Check if user already has a member profile
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("id", data.user.id)
      .single();

    console.log(
      `[auth/verify-otp] verified ok phoneSuffix=${phoneSuffix} isNewUser=${!member}`
    );
    return apiSuccess({
      verified: true,
      isNewUser: !member,
    });
  } catch (err) {
    console.error("[auth/verify-otp] unexpected exception", err);
    return apiError("Verification failed. Check your connection and try again.", 500);
  }
}
