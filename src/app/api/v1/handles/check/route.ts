import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

// Reserved handles that can't be claimed
const RESERVED_HANDLES = new Set([
  "admin",
  "kder",
  "support",
  "help",
  "api",
  "settings",
  "dashboard",
  "listings",
  "orders",
  "earnings",
  "messages",
  "signup",
  "login",
  "onboarding",
]);

/**
 * Normalize a phone string to E.164 with leading "+". Supabase stores
 * `auth.users.phone` without the "+", but we send phones with "+" from
 * the client. Compare a stripped/prefixed form so the same number
 * matches across both sources.
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

function generateSuggestions(handle: string): string[] {
  const suggestions: string[] = [];
  suggestions.push(`${handle}_htx`);
  suggestions.push(`${handle}${Math.floor(Math.random() * 99) + 1}`);
  suggestions.push(`the_${handle}`);
  return suggestions;
}

export async function GET(request: NextRequest) {
  try {
    const handle = request.nextUrl.searchParams.get("handle");

    if (!handle) return apiError("Handle is required.", 400);

    const normalized = handle.toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) {
      return apiError(
        "Letters, numbers, underscores only. 3–30 characters.",
        400
      );
    }

    // Check reserved handles
    if (RESERVED_HANDLES.has(normalized)) {
      return apiSuccess({
        handle: normalized,
        available: false,
        suggestions: generateSuggestions(normalized),
      });
    }

    // Check Supabase for existing handle. We look in BOTH `members`
    // (real activated creators) AND `waitlist_signups` (creators stuck
    // behind A2P 10DLC pending who've reserved their handle). A handle
    // reserved on the waitlist is locked to that phone — until that
    // user is activated or declined, no one else can claim it.
    //
    // The members read is fine via the cookie-bound anon client (RLS
    // allows public reads of handles). The waitlist read needs the
    // service-role client because waitlist_signups is RLS-locked away
    // from public reads (we don't want phone numbers leaking via this
    // availability endpoint).
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const anonClient = await createClient();
    const serviceClient = createServiceClient();

    // Fetch the authed user (if any) so we can detect self-ownership of
    // a waitlist-reserved handle. An onboarded waitlist user picking
    // their OWN reserved handle on /onboarding/handle should see it as
    // available, not taken — without this, they'd get locked out of the
    // exact handle we promised them.
    const { data: { user } } = await anonClient.auth.getUser();
    const userPhone = normalizePhone(user?.phone);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberQ = (anonClient as any)
      .from("members")
      .select("handle")
      .eq("handle", normalized)
      .maybeSingle();
    const waitlistQ = serviceClient
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (serviceClient as any)
          .from("waitlist_signups")
          .select("handle, status, phone")
          .eq("handle", normalized)
          .in("status", ["pending", "invited"]) // 'activated' rolls into members, 'declined' frees the handle
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [memberRes, waitlistRes] = await Promise.all([memberQ, waitlistQ]);

    // Members table hit always means taken (someone else has it).
    if (memberRes.data) {
      return apiSuccess({
        handle: normalized,
        available: false,
        suggestions: generateSuggestions(normalized),
      });
    }

    // Waitlist hit by ANOTHER phone means taken. Hit by THIS user's
    // phone means it's their own reservation — let them claim it.
    if (waitlistRes.data) {
      const reservedPhone = normalizePhone(
        (waitlistRes.data as { phone?: string }).phone
      );
      const isOwnReservation =
        reservedPhone !== null &&
        userPhone !== null &&
        reservedPhone === userPhone;
      if (!isOwnReservation) {
        return apiSuccess({
          handle: normalized,
          available: false,
          suggestions: generateSuggestions(normalized),
        });
      }
      // Fall through — handle is theirs.
    }

    return apiSuccess({
      handle: normalized,
      available: true,
    });
  } catch {
    return apiError("Handle check failed. Try again.", 500);
  }
}
