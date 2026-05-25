import { notFound, redirect } from "next/navigation";
import { QuoteReviewClient } from "./quote-review-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}

/**
 * Standalone customer-facing quote review + deposit-pay page.
 *
 * This URL is the one in the customer's email — designed to be
 * shareable + accessible without navigating through the app UI. Server
 * component loads the quote + creator + inquiry context, then hands
 * off to the client for the "Pay Deposit" button + Stripe Checkout
 * redirect.
 *
 * On Stripe success URL bounce, ?paid=1 is set — we render the
 * "thank you" success state.
 */
export default async function CateringQuotePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { paid } = await searchParams;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // No auth = no quote. Bounce to signup with a returnTo so the
    // customer comes back here after creating an account.
    redirect(`/signup?returnTo=${encodeURIComponent(`/catering/quote/${id}`)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from("catering_quotes")
    .select(`
      id, inquiry_id, creator_id, member_id, status,
      line_items, food_subtotal_cents, fees_cents, tax_cents,
      total_cents, deposit_cents, balance_cents,
      creator_notes, expires_at, created_at,
      inquiry:catering_inquiries(event_date, event_time, guest_count, event_address),
      creator:creators(member:members(display_name, handle, photo_url))
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  // Only the customer the quote was sent to (or the creator) gets here.
  // RLS already enforces this; we just bail to a clear 404 to avoid
  // leaking that a quote exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select("id")
    .eq("member_id", user.id)
    .single();
  const isCreator = creator?.id === quote.creator_id;
  const isCustomer = quote.member_id === user.id;
  if (!isCustomer && !isCreator) notFound();

  return (
    <QuoteReviewClient
      quote={quote}
      paidParam={paid === "1"}
      viewerRole={isCreator ? "creator" : "customer"}
    />
  );
}
