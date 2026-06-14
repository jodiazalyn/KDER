import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side auth + creator resolver used by every creator-only
 * Server Component page (dashboard, listings, orders, messages,
 * catering surfaces).
 *
 * Returns:
 *   { supabase, user, creator }
 *
 * Redirects on failure:
 *   - no auth user → /signup
 *   - auth user without a creators row → /onboarding/creator
 *
 * Replaces ~50 lines of duplicated boilerplate that every
 * Server-Component page used to copy:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) redirect("/signup");
 *   const { data: creator } = await (supabase as any)
 *     .from("creators")
 *     .select("id, ...")
 *     .eq("member_id", user.id)
 *     .single();
 *   if (!creator) redirect("/onboarding/creator");
 *
 * The Supabase client is created on the request scope so
 * downstream loaders can reuse the same instance (cookies stay
 * cached, fewer client constructions per render).
 */

export interface CreatorContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  user: { id: string };
  creator: {
    id: string;
    member_id: string;
    kyc_status: string | null;
    stripe_connect_id: string | null;
  };
}

export async function requireCreator(): Promise<CreatorContext> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/signup");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select("id, member_id, kyc_status, stripe_connect_id")
    .eq("member_id", user.id)
    .single();
  if (!creator) {
    redirect("/onboarding/creator");
  }

  return { supabase, user: { id: user.id }, creator };
}

/**
 * Lighter variant — returns the resolved user + supabase but
 * doesn't enforce a creator row. Used by surfaces that work for
 * both customers and creators (e.g. /messages).
 */
export interface UserContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  user: { id: string };
}

export async function requireUser(): Promise<UserContext> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/signup");
  }
  return { supabase, user: { id: user.id } };
}

/**
 * Admin / cofounder gate for the internal Super Dashboard (`/super`).
 *
 * Authorization is an env-driven email allowlist rather than a DB role,
 * on purpose:
 *   - There are only a handful of cofounders, so an allowlist is the
 *     least-surface, lowest-risk option (no migration, no RLS change,
 *     no risk of a mis-set `role` column escalating a normal user).
 *   - Revoking access is a one-line env edit + redeploy, not a data fix.
 *
 * Set ADMIN_EMAILS to a comma-separated list of the cofounders' login
 * emails (the email on their Supabase auth user), e.g.
 *   ADMIN_EMAILS="jodi@kder.club,cofounder@kder.club"
 * Matching is case-insensitive and trims whitespace.
 *
 * On failure we redirect to "/" (not /signup) and never reveal that the
 * route exists — a logged-in non-admin and a logged-out visitor both
 * just land on the home page.
 *
 * Returns the cofounder's auth identity plus a SERVICE-ROLE client. The
 * dashboard reads across every creator/member/order, which RLS is
 * designed to forbid for a normal session — so once the caller is proven
 * to be an admin, we hand back the service client to do the cross-tenant
 * aggregate reads. Never expose that client to the browser.
 */
export interface AdminContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>;
  user: { id: string; email: string };
}

export async function requireAdmin(): Promise<AdminContext> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || allowlist.length === 0 || !allowlist.includes(email)) {
    redirect("/");
  }

  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  if (!service) {
    // Service key not configured — the dashboard can't read across
    // tenants, so fail closed rather than render an empty/half view.
    redirect("/");
  }

  return { service, user: { id: user.id, email } };
}
