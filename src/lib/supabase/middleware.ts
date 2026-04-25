import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/listings",
  "/orders",
  "/earnings",
  "/messages",
  "/settings",
  "/onboarding",
];

export async function updateSession(request: NextRequest) {
  // Demo mode — skip auth checks when Supabase isn't configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (supabaseUrl.includes("placeholder") || supabaseUrl === "") {
    return NextResponse.next({ request });
  }

  // Fast path: only protected paths actually need the auth check. The
  // landing page, /@<handle> storefronts, and /signup don't gate on auth,
  // so spending 150-300ms on a Supabase round-trip per request was pure
  // tax on every public page view — including the storefront, which is
  // where buyers first land from share links. Skip here.
  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  if (!isProtected) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // In production, redirect unauthenticated users to signup.
  // During development (NODE_ENV !== 'production'), allow browsing
  // so the app is navigable while building features.
  if (!user && process.env.NODE_ENV === "production") {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
