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
          .select("handle, status")
          .eq("handle", normalized)
          .in("status", ["pending", "invited"]) // 'activated' rolls into members, 'declined' frees the handle
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [memberRes, waitlistRes] = await Promise.all([memberQ, waitlistQ]);

    if (memberRes.data || waitlistRes.data) {
      return apiSuccess({
        handle: normalized,
        available: false,
        suggestions: generateSuggestions(normalized),
      });
    }

    return apiSuccess({
      handle: normalized,
      available: true,
    });
  } catch {
    return apiError("Handle check failed. Try again.", 500);
  }
}
