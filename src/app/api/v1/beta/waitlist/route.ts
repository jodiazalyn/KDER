import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { checkRateLimit, OTP_REQUEST_LIMIT } from "@/lib/rate-limiter";
import { notifyBetaSignup } from "@/lib/beta-signup-notifier";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/beta/waitlist
 *
 * Reserves a phone + handle pair for a creator who's stuck behind
 * Twilio A2P 10DLC pending registration. Two guarantees:
 *
 *   1. The handle is locked to this phone — when the user is later
 *      activated via Supabase's test-number list, the handle they
 *      reserved here is theirs, not whichever real signup beat them
 *      to it. Enforced by the unique index on `waitlist_signups.handle`
 *      AND by `/api/v1/handles/check` consulting both `members` and
 *      `waitlist_signups` before reporting available.
 *
 *   2. The same phone re-submitting (e.g. user changes their mind on
 *      the handle, or the page reloads mid-form) updates the existing
 *      row instead of erroring. Upsert on phone uniqueness.
 *
 * Customer-mode signups skip the handle requirement — customers don't
 * have storefront handles in KDER's model.
 *
 * Rate-limited per phone (reuses the OTP request limit) so a brute
 * forcer can't spam handle reservations.
 */

const US_PHONE_REGEX = /^\+1\d{10}$/;
const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

const RESERVED_HANDLES = new Set([
  "admin", "kder", "support", "help", "api", "settings", "dashboard",
  "listings", "orders", "earnings", "messages", "signup", "login", "onboarding",
]);

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode : "creator";
  const rawHandle = typeof body.handle === "string" ? body.handle.trim() : "";
  const displayName =
    typeof body.display_name === "string"
      ? body.display_name.trim().slice(0, 40)
      : null;

  if (!phone) return apiError("Phone number is required.", 400);
  if (!US_PHONE_REGEX.test(phone)) {
    return apiError("Enter a valid US phone number.", 400);
  }
  if (mode !== "creator" && mode !== "customer") {
    return apiError("Invalid mode.", 400);
  }

  // Creators must reserve a handle. Customers don't have one.
  let handle: string | null = null;
  if (mode === "creator") {
    const normalized = rawHandle.toLowerCase();
    if (!normalized) {
      return apiError("Handle is required for creators.", 400);
    }
    if (!HANDLE_REGEX.test(normalized)) {
      return apiError(
        "Letters, numbers, underscores only. 3–30 characters.",
        400
      );
    }
    if (RESERVED_HANDLES.has(normalized)) {
      return apiError("That handle isn't available.", 409, {
        code: "handle_reserved",
      });
    }
    handle = normalized;
  }

  // Per-phone rate limit — same window as OTP request so spam in one
  // place doesn't bypass the spam limit in the other.
  const rate = checkRateLimit(
    `beta_waitlist:${phone}`,
    OTP_REQUEST_LIMIT.maxRequests,
    OTP_REQUEST_LIMIT.windowMs
  );
  if (!rate.allowed) {
    const retryMin = Math.ceil(rate.retryAfterMs / 60000);
    return apiError(
      `Too many requests. Try again in ${retryMin} minute${retryMin > 1 ? "s" : ""}.`,
      429
    );
  }

  // Service-role client: this route is anon-facing, but the writes go
  // into a table whose RLS policies block anon inserts. The route is
  // already the integrity layer (phone format, handle format, reserved-
  // word list, uniqueness checks below), so bypassing RLS is safe and
  // sidesteps PostgREST policy-cache quirks.
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      "[beta/waitlist] SUPABASE_SERVICE_ROLE_KEY not set — cannot write"
    );
    return apiError("Server misconfigured. Try again shortly.", 500);
  }

  // Pre-flight handle uniqueness check across BOTH members and existing
  // waitlist entries. Allows re-submission from the same phone (we'll
  // upsert below) but blocks a different phone from grabbing the same
  // handle. Skip when handle is null (customer mode).
  if (handle) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMember } = await (supabase as any)
      .from("members")
      .select("handle")
      .eq("handle", handle)
      .maybeSingle();
    if (existingMember) {
      return apiError("That handle is already taken.", 409, {
        code: "handle_taken",
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingWaitlist } = await (supabase as any)
      .from("waitlist_signups")
      .select("phone")
      .eq("handle", handle)
      .maybeSingle();
    if (existingWaitlist && existingWaitlist.phone !== phone) {
      return apiError("That handle is already reserved.", 409, {
        code: "handle_reserved",
      });
    }
  }

  // Upsert by phone — re-submitting from the same phone updates the
  // existing reservation rather than erroring. Status defaults to
  // 'pending' on insert and is preserved on update by the migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("waitlist_signups")
    .upsert(
      {
        phone,
        handle,
        display_name: displayName,
        mode,
        user_agent: request.headers.get("user-agent"),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    );

  if (upsertError) {
    // Most common case: race condition on the unique handle constraint.
    if (upsertError.code === "23505") {
      return apiError("That handle is already reserved.", 409, {
        code: "handle_reserved",
      });
    }
    console.error("[beta/waitlist] upsert failed", upsertError);
    return apiError("Couldn't save your spot. Try again.", 500);
  }

  console.log(
    `[beta/waitlist] reserved phoneSuffix=${phone.slice(-4)} handle=${handle ?? "(none)"} mode=${mode}`
  );

  // Fire-and-forget Slack/Discord/Zapier notification with the full
  // captured payload so the operator gets a real-time ping with the
  // exact handle to reserve in Supabase's test-number list.
  notifyBetaSignup({
    phone,
    mode,
    handle,
    displayName,
    source: "beta/waitlist",
    userAgent: request.headers.get("user-agent"),
  });

  return apiSuccess({
    reserved: true,
    handle,
    mode,
  });
}
