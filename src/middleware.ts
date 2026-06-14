import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Convenience: cofounders can reach the Super Dashboard by appending
  // "/super" to ANY path (e.g. /listings/super, /earnings/super,
  // /catering/calendar/super) — not just the bare /super. Any path that
  // ends in a "/super" segment (other than the canonical /super itself)
  // is redirected to the top-level /super route, which then enforces the
  // admin allowlist gate. This keeps a single source of truth for the
  // dashboard while making it muscle-memory-easy to open from wherever
  // you happen to be in the app. Non-admins still bounce to "/" from the
  // /super page itself, so this exposes nothing.
  const { pathname } = request.nextUrl;
  if (pathname !== "/super" && /\/super\/?$/.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/super";
    return NextResponse.redirect(url);
  }

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
