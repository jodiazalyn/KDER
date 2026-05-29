import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/catering/attention-count
 *
 * Lightweight count endpoint used by the BottomNav Calendar
 * badge. Returns:
 *   {
 *     openInquiries:    int (need a quote),
 *     pendingBookings:  int (4hr accept clock — URGENT),
 *     total:            sum of the above,
 *   }
 *
 * Three small COUNT queries — no JOINs, no row payloads. Cheap
 * enough to poll every 60s from the nav. Excludes sent-quote
 * count from the urgency total because waiting-on-customer
 * isn't actionable for the creator; only the inquiry inbox card
 * surfaces those.
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiSuccess({
        openInquiries: 0,
        pendingBookings: 0,
        total: 0,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single();
    if (!creator) {
      return apiSuccess({
        openInquiries: 0,
        pendingBookings: 0,
        total: 0,
      });
    }

    const [openRes, pendingRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("catering_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id)
        .eq("status", "open"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("catering_bookings")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id)
        .eq("status", "pending_acceptance"),
    ]);

    const openInquiries =
      typeof openRes.count === "number" ? openRes.count : 0;
    const pendingBookings =
      typeof pendingRes.count === "number" ? pendingRes.count : 0;

    return apiSuccess({
      openInquiries,
      pendingBookings,
      total: openInquiries + pendingBookings,
    });
  } catch {
    return apiError("Failed to fetch catering attention count.", 500);
  }
}
