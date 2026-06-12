import { apiSuccess, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/env";

/**
 * GET /api/v1/creators/[id]/reviews — public list of a creator's
 * customer reviews (migration 021's order_reviews).
 *
 * `id` is the creators.id (the storefront passes creator.creator_id).
 * Returns newest-first reviews with a privacy-trimmed reviewer name
 * (first name + last initial), plus the rolled-up average + count.
 *
 * Public read: order_reviews has a SELECT-true RLS policy, so this is
 * safe with the anon client. We prefer the service client when
 * configured (skips RLS, future-proofs against policy tightening) and
 * fall back to a stateless anon client otherwise.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client =
      createServiceClient() ??
      createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("order_reviews")
      .select(
        "id, rating, body, created_at, member:members(display_name)"
      )
      .eq("creator_id", id)
      .order("created_at", { ascending: false })
      .limit(100) as {
        data:
          | Array<{
              id: string;
              rating: number;
              body: string | null;
              created_at: string;
              member: { display_name: string | null } | null;
            }>
          | null;
        error: { message: string } | null;
      };

    if (error) {
      console.error("[creators/reviews] query failed:", error.message);
      return apiError("Failed to load reviews.", 500);
    }

    const rows = data ?? [];
    const reviews = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      created_at: r.created_at,
      reviewer_name: privacyName(r.member?.display_name),
    }));

    const count = reviews.length;
    const average =
      count > 0
        ? Math.round(
            (reviews.reduce((s, r) => s + r.rating, 0) / count) * 10
          ) / 10
        : null;

    return apiSuccess({ reviews, count, average });
  } catch (err) {
    console.error("[creators/reviews] error:", err);
    return apiError("Failed to load reviews.", 500);
  }
}

/**
 * Trim a stored display name to "First L." for public display — keeps
 * reviews human (a real first name) without exposing full identities.
 */
function privacyName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "KDER customer";
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}
