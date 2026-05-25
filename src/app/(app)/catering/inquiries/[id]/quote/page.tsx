import { notFound, redirect } from "next/navigation";
import { QuoteBuilderClient } from "./quote-builder-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Creator-side quote builder. Loads the inquiry + the creator's
 * catering listings (for the "add from menu" picker) + any
 * pre-selected items the customer pinned in their inquiry. Hands off
 * to the client for the editor + send action.
 */
export default async function QuoteBuilderPage({ params }: PageProps) {
  const { id } = await params;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select("id")
    .eq("member_id", user.id)
    .single();
  if (!creator) redirect("/onboarding/creator");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (supabase as any)
    .from("catering_inquiries")
    .select(`
      id, creator_id, event_date, event_time, guest_count, event_address,
      needs_server, needs_setup, pre_selected_listing_ids, notes, status,
      member:members(display_name, email)
    `)
    .eq("id", id)
    .single();
  if (!inquiry) notFound();
  if (inquiry.creator_id !== creator.id) notFound();

  // Catering menu for the "add from menu" picker. Only active.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menuListings } = await (supabase as any)
    .from("listings")
    .select(`
      id, name, price, photos, catering_pricing_mode,
      catering_min_guests, catering_max_guests
    `)
    .eq("creator_id", creator.id)
    .eq("kind", "catering")
    .eq("status", "active");

  return (
    <QuoteBuilderClient
      inquiry={inquiry}
      menuListings={menuListings ?? []}
    />
  );
}
