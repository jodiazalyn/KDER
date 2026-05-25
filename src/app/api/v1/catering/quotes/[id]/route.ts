import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/catering/quotes/:id
 *
 * Single-quote fetch with the context the customer-facing review page
 * needs: creator handle + display name, event date, inquiry status.
 *
 * Auth: requires the authenticated user to be either the customer the
 * quote was sent to OR the creator who sent it. RLS on catering_quotes
 * + catering_inquiries enforces this — we don't re-check in route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Sign in to view this quote.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote, error } = await (supabase as any)
      .from("catering_quotes")
      .select(`
        id, inquiry_id, creator_id, member_id,
        line_items, food_subtotal_cents, fees_cents, tax_cents,
        total_cents, deposit_cents, balance_cents,
        creator_notes, expires_at, status, created_at,
        inquiry:catering_inquiries(event_date, event_time, guest_count, event_address),
        creator:creators(
          id, stripe_connect_id, kyc_status,
          catering_balance_days_before,
          member:members(display_name, handle, photo_url)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !quote) {
      return apiError("Quote not found or you don't have access.", 404);
    }

    return apiSuccess({ quote });
  } catch {
    return apiError("Failed to fetch quote.", 500);
  }
}
