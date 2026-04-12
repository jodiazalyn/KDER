/**
 * Demo mode allows navigating the full app
 * without authenticated Supabase sessions.
 *
 * Active when:
 * - Supabase URL contains "placeholder" or is empty
 * - OR running in development (no auth session available yet)
 *
 * In production with real auth, this returns false.
 */
export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.includes("placeholder") || url === "") return true;

  // In development, use demo mode since we don't have auth sessions
  if (process.env.NODE_ENV === "development") return true;

  return false;
}
