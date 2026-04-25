import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/beta/my-reservation
 *
 * Returns the authenticated user's waitlist reservation (if any) so the
 * onboarding flow can pre-fill the handle picker with whatever they
 * reserved during the apply-for-access step. Without this endpoint, an
 * onboarded waitlist user landing on /onboarding/handle on a fresh
 * device (sessionStorage empty) would have to remember and re-type
 * their reserved handle — and worse, they'd hit the availability check
 * and see it as "taken" because the reservation row still locks it.
 *
 * Auth required. Returns null reservation if the user has no phone or
 * no waitlist row matches.
 */

interface WaitlistReservationRow {
  handle: string | null;
  display_name: string | null;
  mode: string | null;
  status: string | null;
}

export async function GET() {
  const { createClient } = await import("@/lib/supabase/server");
  const { createServiceClient } = await import("@/lib/supabase/service");

  const anonClient = await createClient();
  const {
    data: { user },
  } = await anonClient.auth.getUser();

  if (!user) {
    return apiError("Not authenticated.", 401);
  }

  const phone = user.phone
    ? user.phone.startsWith("+")
      ? user.phone
      : `+${user.phone}`
    : null;

  if (!phone) {
    return apiSuccess({ reservation: null });
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    // Service role isn't configured — degrade gracefully. Onboarding
    // will fall back to sessionStorage / typed input.
    console.warn(
      "[beta/my-reservation] SUPABASE_SERVICE_ROLE_KEY not set"
    );
    return apiSuccess({ reservation: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any)
    .from("waitlist_signups")
    .select("handle, display_name, mode, status")
    .eq("phone", phone)
    .in("status", ["pending", "invited"])
    .maybeSingle();

  if (error) {
    console.error("[beta/my-reservation] lookup failed", error);
    return apiSuccess({ reservation: null });
  }

  const row = data as WaitlistReservationRow | null;
  return apiSuccess({
    reservation: row
      ? {
          handle: row.handle,
          display_name: row.display_name,
          mode: row.mode,
          status: row.status,
        }
      : null,
  });
}
