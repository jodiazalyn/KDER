import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Service-role Supabase client for server-side writes that bypass RLS.
 *
 * Use only in API routes where the route itself is the integrity layer
 * (validates inputs, enforces business rules, runs uniqueness checks)
 * and we don't want a missing-or-misconfigured RLS policy to block a
 * legitimate write. Today that's:
 *   - /api/v1/beta/waitlist  — anon inserts into waitlist_signups
 *   - /api/v1/handles/check  — reads from waitlist_signups for handle
 *                              availability across both members + waitlist
 *
 * Never expose this client to the browser. Never call from a Server
 * Component that renders user-controlled paths without auth checks.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY at call time. Returns null if the
 * key isn't configured so callers can degrade gracefully instead of
 * crashing the route.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: {
      // No session persistence — this is a stateless server-side client.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
