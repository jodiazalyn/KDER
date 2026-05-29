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
