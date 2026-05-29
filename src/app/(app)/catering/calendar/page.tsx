import { requireCreator } from "@/lib/loaders/auth";
import { loadCreatorBlackouts } from "@/lib/loaders/blackouts";
import { loadOpenInquiryCount } from "@/lib/loaders/inquiries";
import CalendarClient from "./calendar-client";

/**
 * Creator's catering calendar.
 *
 * Server-component shell hydrates the blackouts list + the
 * open-inquiry count in parallel and hands them to the client
 * island. Eliminates the previous mount-time double fetch
 * (~300-600ms on mobile) — the grid renders with real data on
 * first paint.
 */
export const dynamic = "force-dynamic";

export default async function CateringCalendarPage() {
  const { supabase, creator } = await requireCreator();
  const [blackoutsRes, openInquiryCount] = await Promise.all([
    loadCreatorBlackouts(supabase, creator.id),
    loadOpenInquiryCount(supabase, creator.id),
  ]);
  return (
    <CalendarClient
      initialBlackouts={blackoutsRes.data}
      initialOpenInquiryCount={openInquiryCount}
    />
  );
}
