import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/v1/auth/anon-customer
 *
 * TEMPORARY (Twilio A2P 10DLC pending). Removes OTP friction from
 * customer checkout so a buyer can place an order with just name +
 * one notification channel (phone OR email). Once A2P registration
 * lands, the OTP path returns and this endpoint can be retired.
 *
 * Flow:
 *   1. Validate name (1-40 chars trimmed) + at least one of:
 *      phone (10 US digits) OR email (basic shape match). Delivery
 *      orders require phone upstream (the courier needs to reach
 *      the customer at the door), so the relaxed contract is only
 *      reachable from pickup checkouts.
 *   2. Rate-limit by IP (10/hour) — no SMS gate, so a network-level
 *      limiter is the only friction against bot abuse.
 *   3. supabase.auth.signInAnonymously() — creates an auth.users row
 *      with is_anonymous=true and writes the session cookie via the
 *      SSR client.
 *   4. Upsert a public.members row keyed to that anon user.id with
 *      whatever contact details the customer typed (phone, email, or
 *      both). Upsert (onConflict: id) so a same-device retry updates
 *      rather than 23505s.
 *   5. Return { user_id, phone, email, display_name } so the caller
 *      can proceed straight to /api/v1/checkout — which already
 *      accepts anonymous sessions because user.id is a real UUID.
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
  let body: { name?: unknown; phone?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body?.phone === "string" ? body.phone : "";
  const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";

  if (rawName.length === 0 || rawName.length > NAME_MAX) {
    return apiError(
      `Name is required (1-${NAME_MAX} chars).`,
      400
    );
  }

  // Strip everything but digits, take last 10 — accepts "(323) 555-0123",
  // "323-555-0123", "+13235550123", etc. Same shape callers already use.
  // Phone is now optional at the API level; the caller (CheckoutSheet)
  // enforces it for delivery orders before getting here.
  const digits = rawPhone.replace(/\D/g, "").slice(-PHONE_DIGITS);
  const phoneProvided = digits.length === PHONE_DIGITS;
  const e164Phone = phoneProvided ? `+1${digits}` : null;

  // Loose email validation — anything-at-anything-dot-anything is
  // enough to send a receipt; Stripe/SendGrid will bounce on
  // genuinely invalid addresses.
  const emailLower = rawEmail.toLowerCase().slice(0, 254);
  const emailValid = /\S+@\S+\.\S+/.test(emailLower);

  // At least ONE notification channel is required. If both are
  // missing, the customer has no way to receive order updates and
  // the creator can't reach them.
  if (!phoneProvided && !emailValid) {
    return apiError(
      "Enter a phone number or email so we can send order updates.",
      400
    );
  }

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
    const phoneSuffix = phoneProvided ? digits.slice(-4) : null;
    console.error("[auth/anon-customer] signInAnonymously failed", {
      code: errCode,
      status: (signInError as { status?: number } | null)?.status,
      message: signInError?.message,
      hasUser: !!signInData?.user,
      phoneSuffix,
      hasEmail: emailValid,
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
  // erroring on the PK. Phone/email are written only when supplied
  // so an email-only customer doesn't store an empty phone string
  // (which would later fail E.164 validation downstream).
  const memberRow: Record<string, unknown> = {
    id: userId,
    display_name: cleanName,
    role: "member",
    updated_at: new Date().toISOString(),
  };
  if (e164Phone) memberRow.phone = e164Phone;
  if (emailValid) memberRow.email = emailLower;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("members")
    .upsert(memberRow, { onConflict: "id" });

  if (upsertError) {
    const phoneSuffix = phoneProvided ? digits.slice(-4) : null;
    console.error("[auth/anon-customer] members upsert failed", {
      message: upsertError.message,
      code: (upsertError as { code?: string }).code,
      phoneSuffix,
      hasEmail: emailValid,
    });
    return apiError(
      `Couldn't save your details: ${upsertError.message}`,
      500
    );
  }

  console.log(
    `[auth/anon-customer] ok user_id=${userId} phoneSuffix=${
      phoneProvided ? digits.slice(-4) : "none"
    } email=${emailValid ? "yes" : "no"}`
  );

  return apiSuccess({
    user_id: userId,
    phone: e164Phone, // null when email-only
    email: emailValid ? emailLower : null,
    display_name: cleanName,
  });
}
