import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return apiError("Phone and code are required.", 400);
    }

    if (!/^\d{6}$/.test(code)) {
      return apiError("Incorrect code. Try again.", 400);
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
