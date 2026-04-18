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

    // Check Supabase for existing handle
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("members")
      .select("handle")
      .eq("handle", normalized)
      .single();

    if (existing) {
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
