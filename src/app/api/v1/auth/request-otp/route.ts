import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

const US_PHONE_REGEX = /^\+1\d{10}$/;

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) return apiError("Phone number is required.", 400);
    if (!US_PHONE_REGEX.test(phone)) {
      return apiError("Enter a valid US phone number.", 400);
    }

    // Demo mode — skip real OTP, just acknowledge
    if (isDemoMode()) {
      return apiSuccess({ sent: true, demo: true });
    }

    // Production: use Supabase Auth phone OTP
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
