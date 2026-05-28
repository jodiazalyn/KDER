import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  MapPin,
  Clock,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { BookingActions } from "./booking-actions";
import { InfoTip } from "@/components/ui/info-tip";
import { COACHMARK_COPY } from "@/lib/coachmarks";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

function money(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Creator's booking detail page. Shows event facts + money summary +
 * status banner + action bar (mark complete / retry balance charge /
 * cancel).
 */
export default async function BookingDetailPage({ params }: PageProps) {
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
  const { data: booking } = await (supabase as any)
    .from("catering_bookings")
    .select(`
      id, creator_id, member_id, event_date, event_time, status,
      total_cents, deposit_cents, balance_cents,
      deposit_paid_at, balance_charged_at, balance_charge_scheduled_for,
      last_balance_attempt_at, balance_attempt_count, balance_failure_message,
      completed_at, cancellation_reason, created_at,
      inquiry:catering_inquiries(guest_count, event_address, event_venue_type),
      customer:members!catering_bookings_member_id_fkey(id, display_name, phone, photo_url)
    `)
    .eq("id", id)
    .single();

  if (!booking) notFound();
  if (booking.creator_id !== creator.id) notFound();

  // Pull recent messages between this creator and the customer. The
  // catering routes auto-mirror booking events (deposit paid,
  // accepted, balance charged, completed) into this thread via
  // lib/catering/insert-thread-message.ts — so this surface shows
  // the full timeline of what's been said and what's happened, not
  // just chat.
  let recentMessages: Array<{
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
  }> = [];
  if (booking.customer?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgs } = await (supabase as any)
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${booking.customer.id}),and(sender_id.eq.${booking.customer.id},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(4);
    recentMessages = ((msgs ?? []) as typeof recentMessages).reverse();
  }

  const customerName = booking.customer?.display_name ?? "Customer";

  const eventDateLabel = new Date(
    booking.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTimeLabel = booking.event_time
    ? new Date(`2000-01-01T${booking.event_time}`).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit" }
      )
    : null;

  return (
    // pb-[10rem+safe] reserves room for the stacked footer:
    // BottomNav (5rem) + BookingActions bar (~5rem when active) +
    // breathing room. Padding is constant — even when the action bar
    // doesn't render (completed / cancelled / pending_acceptance) the
    // page bottom doesn't suddenly grow back; preserves predictable
    // scroll behavior across booking states.
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <Link
          href="/catering/bookings"
          aria-label="Back to bookings"
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-white">
            {booking.customer?.display_name ?? "Customer"}
          </h1>
          <p className="truncate text-xs text-white/50">
            {eventDateLabel}
            {eventTimeLabel ? ` · ${eventTimeLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* Balance-due alert */}
        {booking.status === "balance_due" && (
          <div className="rounded-2xl border border-red-400/[0.30] bg-red-900/[0.25] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-red-300"
              />
              <div>
                <div className="flex items-center">
                  <p className="text-sm font-bold text-red-100">
                    Balance charge failed
                  </p>
                  <InfoTip
                    label="What happens next?"
                    triggerClassName="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-red-200/70 hover:text-red-100 active:scale-90 transition-all"
                  >
                    {COACHMARK_COPY["creator-catering-booking-balance-due"]}
                  </InfoTip>
                </div>
                {booking.balance_failure_message && (
                  <p className="mt-1 text-xs text-red-200/80">
                    {booking.balance_failure_message}
                  </p>
                )}
                <p className="mt-2 text-xs text-red-200/70">
                  We&apos;ve tried {booking.balance_attempt_count} time
                  {booking.balance_attempt_count === 1 ? "" : "s"}. You can
                  retry below, or reach out to the customer directly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Event facts */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Event details
          </h2>
          <ul className="space-y-2.5 text-sm">
            <Fact
              icon={CalendarDays}
              value={`${eventDateLabel}${eventTimeLabel ? ` · ${eventTimeLabel}` : ""}`}
            />
            <Fact
              icon={Users}
              value={`${booking.inquiry?.guest_count ?? 0} guests`}
            />
            {booking.inquiry?.event_address && (
              <Fact icon={MapPin} value={booking.inquiry.event_address} />
            )}
          </ul>
        </section>

        {/* Money summary */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Money
          </h2>
          <ul className="space-y-2 text-sm">
            <Row label="Total" value={money(booking.total_cents)} bold />
            <Row
              label={`Deposit · paid ${new Date(booking.deposit_paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              value={money(booking.deposit_cents)}
              muted
            />
            <Row
              label={
                booking.balance_charged_at
                  ? `Balance · charged ${new Date(booking.balance_charged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : booking.balance_charge_scheduled_for
                    ? `Balance · scheduled ${new Date(booking.balance_charge_scheduled_for).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "Balance"
              }
              value={money(booking.balance_cents)}
              accent={!booking.balance_charged_at}
              muted={!!booking.balance_charged_at}
            />
          </ul>
        </section>

        {/* Lifecycle timestamps */}
        {(booking.completed_at || booking.cancellation_reason) && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Status
            </h2>
            {booking.completed_at && (
              <p className="text-sm text-white/80">
                <Clock size={14} className="inline -mt-0.5 mr-1.5 text-white/40" />
                Marked complete{" "}
                {new Date(booking.completed_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
            {booking.cancellation_reason && (
              <p className="text-sm text-white/80">
                <AlertCircle size={14} className="inline -mt-0.5 mr-1.5 text-white/40" />
                Cancelled: {booking.cancellation_reason}
              </p>
            )}
          </section>
        )}

        {/* Recent messages + chat-thread shortcut. The thread is
            where catering events (deposit paid, accepted, balance
            charged) are also mirrored, so this is effectively the
            full activity log for this booking. */}
        {recentMessages.length > 0 && booking.customer?.id ? (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Recent messages
              </h2>
              <Link
                // /messages/[threadId] expects the slug
                // "general_{partnerId}" — passing a bare UUID lands on
                // an empty thread (the route slices the first 8 chars
                // off thinking they're the literal "general_" prefix).
                href={`/messages/general_${booking.customer.id}`}
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
        ) : (
          <Link
            href={
              booking.customer?.id
                ? `/messages/general_${booking.customer.id}`
                : "/messages"
            }
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
          >
            <MessageCircle size={16} />
            Open chat thread
          </Link>
        )}
      </div>

      <BookingActions bookingId={id} status={booking.status} />
    </div>
  );
}

function Fact({
  icon: Icon,
  value,
}: {
  icon: typeof Clock;
  value: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-white/40" />
      <span className="text-white">{value}</span>
    </li>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span
        className={`text-sm ${bold ? "font-bold text-white" : accent ? "text-green-300" : muted ? "text-white/50" : "text-white/70"}`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 text-sm tabular-nums ${bold ? "text-base font-bold text-white" : accent ? "font-bold text-green-300" : muted ? "text-white/60" : "text-white/90"}`}
      >
        {value}
      </span>
    </li>
  );
}
