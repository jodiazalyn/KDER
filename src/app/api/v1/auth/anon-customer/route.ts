import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/v1/auth/anon-customer
 *
 * TEMPORARY (Twilio A2P 10DLC pending). Removes OTP friction from
 * customer checkout so a buyer can place an order with just name +
 * phone. Once A2P registration lands, the OTP path returns and this
 * endpoint can be retired.
 *
 * Flow:
 *   1. Validate name (1-40 chars trimmed) + phone (10 US digits).
 *   2. Rate-limit by IP (10/hour) — no SMS gate, so a network-level
 *      limiter is the only friction against bot abuse.
 *   3. supabase.auth.signInAnonymously() — creates an auth.users row
 *      with is_anonymous=true and writes the session cookie via the
 *      SSR client.
 *   4. Upsert a public.members row keyed to that anon user.id with
 *      the typed phone + display_name. Upsert (onConflict: id) so a
 *      same-device retry updates rather than 23505s.
 *   5. Return { user_id, phone, display_name } so the caller can
 *      proceed straight to /api/v1/checkout — which already accepts
 *      anonymous sessions because user.id is a real UUID.
 *
 * Required Supabase config: Auth → Providers → Anonymous Sign-Ins
 * must be ON. If it's not, signInAnonymously returns the
 * `anonymous_provider_disabled` code which we surface as a 503 so
 * the operator sees the misconfiguration loudly during verification.
 */

const NAME_MAX = 40;
const PHONE_DIGITS = 10;
// 10 attempts / IP / hour. Higher than OTP_REQUEST_LIMIT because:
// (a) no per-attempt SMS cost, (b) legitimate customers may retry
// after typos, (c) Stripe payment is still required for a real order
// so abuse upside is bounded.
const ANON_CUSTOMER_LIMIT = { maxRequests: 10, windowMs: 60 * 60 * 1000 };

function getClientIp(request: NextRequest): string {
  // Standard proxy chain: prefer x-forwarded-for first hop.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body?.phone === "string" ? body.phone : "";

  if (rawName.length === 0 || rawName.length > NAME_MAX) {
    return apiError(
      `Name is required (1-${NAME_MAX} chars).`,
      400
    );
  }

  // Strip everything but digits, take last 10 — accepts "(323) 555-0123",
  // "323-555-0123", "+13235550123", etc. Same shape callers already use.
  const digits = rawPhone.replace(/\D/g, "").slice(-PHONE_DIGITS);
  if (digits.length !== PHONE_DIGITS) {
    return apiError("Enter a valid US phone number.", 400);
  }
  const e164Phone = `+1${digits}`;

  // HTML-strip the display name like /api/v1/members/create:34 does.
  const cleanName = rawName.replace(/<[^>]*>/g, "").trim();
  if (cleanName.length === 0) {
    return apiError("Name is required.", 400);
  }

  // Rate limit by IP. Phone-based rate limiting would be cheaper to
  // bypass (rotate phone numbers) and would punish legitimate retries
  // from the same device.
  const ip = getClientIp(request);
  const rl = checkRateLimit(
    `anon_customer:${ip}`,
    ANON_CUSTOMER_LIMIT.maxRequests,
    ANON_CUSTOMER_LIMIT.windowMs
  );
  if (!rl.allowed) {
    const retryMin = Math.ceil(rl.retryAfterMs / 60000);
    return apiError(
      `Too many requests. Try again in ${retryMin} minute${retryMin === 1 ? "" : "s"}.`,
      429
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Anonymous sign-in. The SSR client writes the session cookies on
  // the response automatically.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInAnonymously();

  if (signInError || !signInData?.user) {
    const errCode = (signInError as { code?: string } | null)?.code;
    const phoneSuffix = digits.slice(-4);
    console.error("[auth/anon-customer] signInAnonymously failed", {
      code: errCode,
      status: (signInError as { status?: number } | null)?.status,
      message: signInError?.message,
      hasUser: !!signInData?.user,
      phoneSuffix,
    });
    // anonymous_provider_disabled: operator hasn't toggled Anonymous
    // Sign-Ins ON in Supabase Auth → Providers. Surface clearly.
    if (errCode === "anonymous_provider_disabled") {
      return apiError(
        "Guest checkout isn't enabled yet. Please try again in a moment.",
        503,
        { code: errCode }
      );
    }
    return apiError(
      "Couldn't start your order. Try again.",
      500,
      errCode ? { code: errCode } : undefined
    );
  }

  const userId = signInData.user.id;

  // Upsert the members row keyed to the anon user. onConflict: 'id'
  // so a same-device retry updates the existing row instead of
  // erroring on the PK.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("members")
    .upsert(
      {
        id: userId,
        phone: e164Phone,
        display_name: cleanName,
        role: "member",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    const phoneSuffix = digits.slice(-4);
    console.error("[auth/anon-customer] members upsert failed", {
      message: upsertError.message,
      code: (upsertError as { code?: string }).code,
      phoneSuffix,
    });
    return apiError(
      `Couldn't save your details: ${upsertError.message}`,
      500
    );
  }

  console.log(
    `[auth/anon-customer] ok user_id=${userId} phoneSuffix=${digits.slice(-4)}`
  );

  return apiSuccess({
    user_id: userId,
    phone: e164Phone,
    display_name: cleanName,
  });
}
