import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/creators/connect/status — Return the current creator's
 * Stripe Connect readiness so the earnings page UI and the PlateForm
 * can render the right state (button, badge, disabled Active option).
 *
 * Response shape:
 *   {
 *     kyc_status: 'not_started' | 'pending' | 'verified' | 'failed',
 *     has_account: boolean
 *   }
 *
 * We deliberately do NOT return the raw stripe_connect_id to the client —
 * the account ID is a server-side secret we only pass to Stripe.
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("stripe_connect_id, kyc_status")
      .eq("member_id", user.id)
      .single() as {
        data: {
          stripe_connect_id: string | null;
          kyc_status: string | null;
        } | null;
      };

    if (!creator) {
      return apiError("Creator profile not found.", 404);
    }

    return apiSuccess({
      kyc_status: creator.kyc_status || "not_started",
      has_account: Boolean(creator.stripe_connect_id),
    });
  } catch (err) {
    console.error("Connect status error:", err);
    return apiError("Failed to load Connect status.", 500);
  }
}
