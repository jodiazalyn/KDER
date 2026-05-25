import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Building2,
  AlertTriangle,
  MessageCircle,
  Sparkles,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Single inquiry detail page for the creator. Shows everything the
 * customer submitted + their pre-selected items + a "Build quote" CTA
 * (wired up in PR 3 — for now it links to the inquiry inbox so the
 * page is functional but the quote builder is a stub).
 */
export default async function InquiryDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // /login doesn't exist in this app — only sign-in path is /signup.
  if (!user) redirect("/signup");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inq } = await (supabase as any)
    .from("catering_inquiries")
    .select(`
      id, event_date, event_time, event_end_time, guest_count, event_address,
      event_venue_type, indoor_outdoor, needs_server, needs_setup,
      earliest_setup_time, kitchen_available, allergies, notes,
      pre_selected_listing_ids, status, created_at,
      member:members(id, display_name, phone, photo_url, email)
    `)
    .eq("id", id)
    .single();

  if (!inq) notFound();

  // Fetch pre-selected listings (if any).
  let selectedListings: Array<{
    id: string;
    name: string;
    price: number;
    catering_pricing_mode: string | null;
  }> = [];
  if (inq.pre_selected_listing_ids?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("listings")
      .select("id, name, price, catering_pricing_mode")
      .in("id", inq.pre_selected_listing_ids);
    selectedListings = (data ?? []) as typeof selectedListings;
  }

  const eventDateLabel = new Date(
    inq.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTimeLabel = inq.event_time
    ? new Date(`2000-01-01T${inq.event_time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const customer = inq.member;
  const customerName = customer?.display_name ?? "Customer";

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <Link
          href="/catering/inquiries"
          aria-label="Back to inquiries"
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-white">
            {customerName}
          </h1>
          <p className="truncate text-xs text-white/50">
            {eventDateLabel}
            {eventTimeLabel ? ` · ${eventTimeLabel}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
            inq.status === "open"
              ? "bg-amber-900/40 text-amber-300"
              : inq.status === "quoted"
                ? "bg-blue-900/40 text-blue-300"
                : "bg-white/10 text-white/60"
          }`}
        >
          {inq.status}
        </span>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* Event facts grid */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Event details
          </h2>
          <ul className="space-y-2.5 text-sm">
            <FactRow icon={Calendar} label="Date" value={eventDateLabel} />
            {eventTimeLabel && (
              <FactRow
                icon={Clock}
                label="Time"
                value={`${eventTimeLabel}${
                  inq.event_end_time
                    ? `–${new Date(`2000-01-01T${inq.event_end_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                    : ""
                }`}
              />
            )}
            <FactRow icon={Users} label="Guests" value={String(inq.guest_count)} />
            {inq.event_address && (
              <FactRow icon={MapPin} label="Location" value={inq.event_address} />
            )}
            {inq.event_venue_type && (
              <FactRow
                icon={Building2}
                label="Venue"
                value={`${inq.event_venue_type}${inq.indoor_outdoor ? ` · ${inq.indoor_outdoor}` : ""}`}
              />
            )}
          </ul>
        </section>

        {/* Setup / logistics */}
        {(inq.needs_server || inq.needs_setup || inq.kitchen_available !== null) && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Logistics
            </h2>
            <ul className="space-y-1.5 text-sm text-white/80">
              {inq.needs_server && <li>• Server requested for the event</li>}
              {inq.needs_setup && (
                <li>
                  • Setup help requested
                  {inq.earliest_setup_time
                    ? ` (earliest ${new Date(`2000-01-01T${inq.earliest_setup_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`
                    : ""}
                </li>
              )}
              {inq.kitchen_available !== null && (
                <li>
                  • Kitchen at venue:{" "}
                  {inq.kitchen_available ? "available" : "not available"}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Allergies */}
        {inq.allergies && (
          <section className="rounded-2xl border border-amber-400/[0.20] bg-amber-900/[0.10] p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <AlertTriangle size={12} />
              Allergies / restrictions
            </h2>
            <p className="text-sm text-white/90">{inq.allergies}</p>
          </section>
        )}

        {/* Pre-selected items */}
        {selectedListings.length > 0 && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Items they&apos;re interested in
            </h2>
            <ul className="space-y-1.5 text-sm">
              {selectedListings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between text-white/80"
                >
                  <span className="truncate">{l.name}</span>
                  <span className="shrink-0 text-white/60">
                    ${l.price.toFixed(0)}
                    {l.catering_pricing_mode === "per_head" ? "/guest" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-white/40">
              These get auto-added to the quote when you start building it.
            </p>
          </section>
        )}

        {/* Customer notes */}
        {inq.notes && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Notes from {customerName}
            </h2>
            <p className="whitespace-pre-wrap text-sm text-white/80">{inq.notes}</p>
          </section>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/80 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto flex max-w-lg gap-2">
          {/* Message customer — uses existing thread system */}
          <Link
            href={`/messages/${customer?.id ?? ""}`}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.10] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] active:scale-95"
          >
            <MessageCircle size={16} />
            Message
          </Link>
          {/* Build quote — PR 3 will wire this up to /catering/inquiries/[id]/quote */}
          <button
            type="button"
            disabled
            className="flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-white/[0.08] text-sm font-bold text-white/40"
            title="Quote builder ships in the next update"
          >
            <Sparkles size={16} />
            Build quote
          </button>
        </div>
      </div>
    </div>
  );
}

/** Single fact row in the event-details list. */
function FactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-white/40" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          {label}
        </p>
        <p className="text-white">{value}</p>
      </div>
    </li>
  );
}
