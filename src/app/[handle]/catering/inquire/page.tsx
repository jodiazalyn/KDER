import { notFound } from "next/navigation";
import { InquiryForm } from "./inquiry-form";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ items?: string }>;
}

/**
 * Customer-facing catering inquiry page. Server component fetches
 * the creator + their catering listings + their blackouts, then hands
 * the data off to the client form. Pre-selected listing IDs come in
 * via `?items=uuid,uuid`.
 *
 * We do the data fetch server-side so the date picker can disable
 * blacked-out dates immediately (no client-side blackout flash).
 */
export default async function CateringInquirePage({
  params,
  searchParams,
}: PageProps) {
  const { handle } = await params;
  const { items: itemsParam } = await searchParams;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Resolve creator from handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select(`
      id, catering_balance_days_before,
      members!inner(handle, display_name, photo_url)
    `)
    .eq("members.handle", handle)
    .single();

  if (!creator) notFound();

  // Catering listings for the menu summary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cateringListings } = await (supabase as any)
    .from("listings")
    .select(`
      id, name, price, photos, kind,
      catering_pricing_mode, catering_min_guests, catering_max_guests,
      catering_lead_time_hours, catering_fulfillment, catering_inclusions,
      catering_inclusion_groups
    `)
    .eq("creator_id", creator.id)
    .eq("kind", "catering")
    .eq("status", "active");

  // Blackouts so the date picker can gray out unavailable dates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blackouts } = await (supabase as any)
    .from("creator_blackouts")
    .select("kind, blackout_date, weekday")
    .eq("creator_id", creator.id);

  const preSelectedIds = itemsParam
    ? itemsParam.split(",").filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    : [];

  return (
    <InquiryForm
      handle={handle}
      creatorId={creator.id}
      creatorName={creator.members.display_name}
      creatorPhoto={creator.members.photo_url}
      listings={cateringListings ?? []}
      blackouts={blackouts ?? []}
      preSelectedIds={preSelectedIds}
    />
  );
}
