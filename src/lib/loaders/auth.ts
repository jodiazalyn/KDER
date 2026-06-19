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
 * Authorization is an env-driven allowlist rather than a DB role, on
 * purpose:
 *   - There are only a handful of cofounders, so an allowlist is the
 *     least-surface, lowest-risk option (no migration, no RLS change,
 *     no risk of a mis-set `role` column escalating a normal user).
 *   - Revoking access is a one-line env edit + redeploy, not a data fix.
 *
 * A cofounder matches if ANY of these identifies them — set whichever is
 * easiest, you don't need all three:
 *   - ADMIN_EMAILS   — their Supabase AUTH login email (not the
 *                      members.email contact field, which can differ /
 *                      be empty for phone-only logins)
 *   - ADMIN_IDS      — their auth user UUID (the most precise; never
 *                      changes regardless of how they log in)
 *   - ADMIN_HANDLES  — their @handle from the members table (most
 *                      human-friendly; a leading "@" is optional)
 * Each is a comma-separated list; matching is case-insensitive +
 * whitespace-trimmed.
 *
 * On failure we redirect to "/" (not /signup) and never reveal that the
 * route exists — a logged-in non-admin and a logged-out visitor both
 * just land on the home page.
 */

function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminCheck {
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}

/**
 * Non-redirecting admin evaluation backing requireAdmin (the route gate).
 * Does the cheap checks (email, UUID) first and only hits the DB for the
 * handle lookup if a handle allowlist is configured and nothing has
 * matched yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateAdmin(supabase: SupabaseClient<any>): Promise<AdminCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, userId: null, email: null };

  const email = user.email?.trim().toLowerCase() ?? "";
  const emails = parseAllowlist(process.env.ADMIN_EMAILS);
  const ids = parseAllowlist(process.env.ADMIN_IDS);
  const handles = parseAllowlist(process.env.ADMIN_HANDLES).map((h) =>
    h.replace(/^@/, "")
  );

  let isAdmin =
    (email.length > 0 && emails.includes(email)) ||
    ids.includes(user.id.toLowerCase());

  if (!isAdmin && handles.length > 0) {
    const { data: member } = await supabase
      .from("members")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle();
    const handle = (member?.handle ?? "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (handle && handles.includes(handle)) isAdmin = true;
  }

  return { isAdmin, userId: user.id, email: email || null };
}

/**
 * Hard gate for the dashboard route. Returns the cofounder's auth
 * identity plus a SERVICE-ROLE client. The dashboard reads across every
 * creator/member/order, which RLS is designed to forbid for a normal
 * session — so once the caller is proven an admin, we hand back the
 * service client to do the cross-tenant aggregate reads. Never expose
 * that client to the browser.
 */
export interface AdminContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>;
  user: { id: string; email: string };
}

export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) {
    // Not an admin, or the service key is unset (can't read across
    // tenants) — fail closed rather than render an empty/half view.
    redirect("/");
  }
  return ctx;
}

/**
 * Non-redirecting variant of {@link requireAdmin} for API routes, which
 * must return a JSON 403 rather than issue an HTTP redirect. Returns the
 * service-role client + identity when the caller is a proven admin AND
 * the service key is configured; otherwise `null`. Never expose the
 * returned service client to the browser.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { isAdmin, userId, email } = await evaluateAdmin(supabase);
  if (!isAdmin || !userId) return null;

  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  if (!service) return null;

  return { service, user: { id: userId, email: email ?? "" } };
}
