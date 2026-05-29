import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single source of truth for the creator's "in-flight catering"
 * surfaces. Used by:
 *   - the rich card on /orders (CateringInflightCard)
 *   - the BottomNav Calendar badge count
 *   - the inbox tab counts on /catering/inquiries
 *
 * Three buckets a creator needs eyes on between an inquiry
 * landing and the booking being confirmed:
 *
 *   1. OPEN inquiries — customer requested catering, creator
 *      hasn't sent a quote yet. Action: send a quote.
 *
 *   2. SENT quotes — quote out, deposit not yet paid. Action:
 *      wait (but follow up if it's been sitting too long).
 *
 *   3. PENDING bookings — deposit paid, creator has a 4-hour
 *      window to accept before the booking auto-declines. HIGH
 *      URGENCY. Action: accept or decline immediately.
 *
 * Returns lightweight summaries (id + customer name + event date
 * + relevant timestamp). Detail pages pull the full row when
 * the creator drills in.
 */

export interface CateringInflightItem {
  /** Inquiry / quote / booking id depending on bucket. The list
   *  view links to the inquiry detail page in all three cases,
   *  so the id used here is the parent inquiry id. */
  inquiryId: string;
  /** What to call the customer in the row label. */
  customerName: string;
  /** ISO YYYY-MM-DD. */
  eventDate: string;
  /** Optional event_time for displaying full datetime. */
  eventTime: string | null;
  /** Number of guests — useful context glance. */
  guestCount: number;
  /** Quote total in cents (only on `sent` quotes + pending
   *  bookings — open inquiries don't have one yet). */
  totalCents: number | null;
  /** For pending bookings: when the 4-hour accept window
   *  expires. Render as a countdown so the creator sees the
   *  urgency drop. */
  acceptDeadline: string | null;
  /** For sent quotes: when the deposit-pay window expires. */
  quoteExpiresAt: string | null;
}

export interface CateringInflight {
  openInquiries: CateringInflightItem[];
  sentQuotes: CateringInflightItem[];
  pendingBookings: CateringInflightItem[];
}

export async function loadCateringInflight(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creatorId: string
): Promise<CateringInflight> {
  // Three independent queries — fire in parallel. All three are
  // small (we cap at 20 each; a creator with more than 20
  // pending anything has bigger problems than this card can
  // solve).
  const [openInquiriesRes, sentQuotesRes, pendingBookingsRes] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("catering_inquiries")
        .select(
          "id, event_date, event_time, guest_count, member:members(display_name)"
        )
        .eq("creator_id", creatorId)
        .eq("status", "open")
        .order("event_date", { ascending: true })
        .limit(20),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("catering_quotes")
        .select(
          "id, total_cents, expires_at, inquiry:catering_inquiries(id, event_date, event_time, guest_count, member:members(display_name))"
        )
        .eq("creator_id", creatorId)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(20),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("catering_bookings")
        .select(
          "id, accept_deadline, total_cents, inquiry:catering_inquiries(id, event_date, event_time, guest_count, member:members(display_name))"
        )
        .eq("creator_id", creatorId)
        .eq("status", "pending_acceptance")
        .order("accept_deadline", { ascending: true })
        .limit(20),
    ]);

  const openInquiries: CateringInflightItem[] = (
    openInquiriesRes.data ?? []
  ).map(
    (r: {
      id: string;
      event_date: string;
      event_time: string | null;
      guest_count: number;
      member: { display_name: string } | null;
    }) => ({
      inquiryId: r.id,
      customerName: r.member?.display_name ?? "Customer",
      eventDate: r.event_date,
      eventTime: r.event_time,
      guestCount: r.guest_count,
      totalCents: null,
      acceptDeadline: null,
      quoteExpiresAt: null,
    })
  );

  const sentQuotes: CateringInflightItem[] = (
    sentQuotesRes.data ?? []
  )
    .filter(
      (r: {
        inquiry: { id: string } | null;
      }) => !!r.inquiry
    )
    .map(
      (r: {
        total_cents: number;
        expires_at: string;
        inquiry: {
          id: string;
          event_date: string;
          event_time: string | null;
          guest_count: number;
          member: { display_name: string } | null;
        };
      }) => ({
        inquiryId: r.inquiry.id,
        customerName: r.inquiry.member?.display_name ?? "Customer",
        eventDate: r.inquiry.event_date,
        eventTime: r.inquiry.event_time,
        guestCount: r.inquiry.guest_count,
        totalCents: r.total_cents,
        acceptDeadline: null,
        quoteExpiresAt: r.expires_at,
      })
    );

  const pendingBookings: CateringInflightItem[] = (
    pendingBookingsRes.data ?? []
  )
    .filter(
      (r: {
        inquiry: { id: string } | null;
      }) => !!r.inquiry
    )
    .map(
      (r: {
        accept_deadline: string | null;
        total_cents: number;
        inquiry: {
          id: string;
          event_date: string;
          event_time: string | null;
          guest_count: number;
          member: { display_name: string } | null;
        };
      }) => ({
        inquiryId: r.inquiry.id,
        customerName: r.inquiry.member?.display_name ?? "Customer",
        eventDate: r.inquiry.event_date,
        eventTime: r.inquiry.event_time,
        guestCount: r.inquiry.guest_count,
        totalCents: r.total_cents,
        acceptDeadline: r.accept_deadline,
        quoteExpiresAt: null,
      })
    );

  return { openInquiries, sentQuotes, pendingBookings };
}
