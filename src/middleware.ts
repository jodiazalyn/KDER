import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclude `api/` from the matcher entirely. The middleware's
  // `updateSession` only does real work on protected page paths
  // (dashboard / listings / orders / earnings / messages /
  // settings / onboarding / catering) — it short-circuits for
  // everything else. API routes either don't need auth (auth
  // bridge, checkout, webhooks) or call `supabase.auth.getUser()`
  // themselves inside the route handler, which refreshes cookies
  // via the server-side Supabase client. Either way the middleware
  // function invocation on every API call was pure overhead.
  // Skipping it here saves ~5-20ms per API request.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/|signup|order-confirmation).*)",
  ],
};
