import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  Users,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { InquiryActions } from "./inquiry-actions";

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

  // Fetch the latest non-superseded quote and the booking (if any) for
  // this inquiry. The InquiryActions component branches on these to
  // pick the right CTA / banner.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: quoteRows }, { data: bookingRows }] = await Promise.all([
    sb
      .from("catering_quotes")
      .select("id, status, total_cents, deposit_cents, expires_at")
      .eq("inquiry_id", id)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1),
    sb
      .from("catering_bookings")
      .select("id, status, accept_deadline")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const quote = quoteRows?.[0] ?? null;
  const booking = bookingRows?.[0] ?? null;

  // Pull the most recent messages between this creator and the
  // customer (in either direction). Shown inline so the creator
  // doesn't have to bounce to /messages to remember what's been said.
  // The catering routes auto-mirror inquiry/quote/booking events into
  // this same thread (see lib/catering/insert-thread-message.ts), so
  // this surface effectively shows "everything connected to the
  // order" — system events + back-and-forth chat — in one place.
  let recentMessages: Array<{
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
  }> = [];
  if (inq.member?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgs } = await (supabase as any)
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${inq.member.id}),and(sender_id.eq.${inq.member.id},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(4);
    recentMessages = ((msgs ?? []) as typeof recentMessages).reverse();
  }

  // Fetch pre-selected listings (if any). Pulls inclusion_groups too so
  // the row can show what's in each item the customer wanted.
  let selectedListings: Array<{
    id: string;
    name: string;
    price: number;
    catering_pricing_mode: string | null;
    catering_inclusion_groups: Record<string, string[]> | null;
  }> = [];
  if (inq.pre_selected_listing_ids?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("listings")
      .select("id, name, price, catering_pricing_mode, catering_inclusion_groups")
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

  // True when the creator hasn't yet acted on this lead — drives the
  // "what to do next" callout. We only nudge when there's a clear next
  // step the creator hasn't taken yet.
  const needsCreatorResponse =
    inq.status === "open" && !quote && !booking;

  return (
    // pb-[10rem+safe] reserves room for the stacked footer:
    // BottomNav (5rem) + InquiryActions bar (~5rem) + breathing room.
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(10rem+env(safe-area-inset-bottom))]">
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
        {/* "What to do next" callout — only when the creator hasn't
            responded yet. Tells them exactly which button to tap and
            why. Removes itself the moment they act (open status flips
            to quoted/booked). Belt-and-suspenders for the bottom
            action bar — even if it's clipped on an odd device, this
            in-content prompt makes the next step obvious. */}
        {needsCreatorResponse && (
          <section className="rounded-2xl border border-amber-400/[0.30] bg-amber-900/[0.20] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <Clock size={12} />
              {customerName} is waiting on you
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-50">
              Send a quick message to introduce yourself, or build them
              a quote. Use the{" "}
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.10] px-1.5 py-0.5 text-[11px] font-bold text-white">
                <MessageCircle size={11} /> Message
              </span>{" "}
              or{" "}
              <span className="inline-flex items-center gap-1 rounded-md bg-[#1B5E20] px-1.5 py-0.5 text-[11px] font-bold text-white">
                ✨ Build quote
              </span>{" "}
              buttons at the bottom of this page.
            </p>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-200/80">
              <ArrowDown size={11} className="animate-bounce" />
              Scroll down if you don&apos;t see them yet
            </p>
          </section>
        )}

        {/* Recent messages — last few back-and-forth (and any auto-
            mirrored system events from the catering routes) so the
            creator can see what's already been said before they reply.
            Hidden when there's nothing in the thread. */}
        {recentMessages.length > 0 && customer?.id && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Recent messages
              </h2>
              <Link
                href={`/messages/${customer.id}`}
                className="flex items-center gap-1 text-[11px] font-semibold text-green-300 hover:text-green-200"
              >
                Open chat
                <MessageCircle size={11} />
              </Link>
            </div>
            <ul className="space-y-2.5">
              {recentMessages.map((m) => {
                const fromCreator = m.sender_id === user.id;
                return (
                  <li
                    key={m.id}
                    className={`flex flex-col gap-0.5 ${
                      fromCreator ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      {fromCreator ? "You" : customerName} ·{" "}
                      {new Date(m.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        fromCreator
                          ? "rounded-br-md bg-[#1B5E20] text-white"
                          : "rounded-bl-md bg-white/[0.06] text-white/90"
                      }`}
                    >
                      {m.body}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
            <ul className="space-y-2 text-sm">
              {selectedListings.map((l) => {
                const groups = l.catering_inclusion_groups || {};
                const summary = Object.entries(groups)
                  .filter(([, items]) => Array.isArray(items) && items.length > 0)
                  .slice(0, 3)
                  .map(([group, items]) => `${group}: ${items[0]}`)
                  .join(" · ");
                return (
                  <li key={l.id} className="text-white/80">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 text-white/60">
                        ${l.price.toFixed(0)}
                        {l.catering_pricing_mode === "per_head" ? "/guest" : ""}
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-0.5 truncate text-[11px] text-white/40">
                        {summary}
                      </p>
                    )}
                  </li>
                );
              })}
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

      {/* Status banner + sticky action bar, both branching on quote +
          booking state. See InquiryActions for the state matrix. */}
      <InquiryActions
        inquiryId={id}
        customerMemberId={customer?.id ?? null}
        customerName={customerName}
        quote={quote}
        booking={booking}
      />
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
