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
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberQ = (supabase as any)
      .from("members")
      .select("handle")
      .eq("handle", normalized)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waitlistQ = (supabase as any)
      .from("waitlist_signups")
      .select("handle, status")
      .eq("handle", normalized)
      .in("status", ["pending", "invited"]) // 'activated' rolls into members, 'declined' frees the handle
      .maybeSingle();

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
