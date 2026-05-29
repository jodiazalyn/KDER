import Link from "next/link";
import { Inbox, FileText, Clock, ChevronRight, Users } from "lucide-react";
import type {
  CateringInflight,
  CateringInflightItem,
} from "@/lib/loaders/catering-inflight";

/**
 * Rich "in-flight catering" card. Replaces the older
 * `CateringInquiryBanner` (which showed only the count of open
 * inquiries). Surfaces three buckets the creator needs to track
 * between an inquiry landing and a booking being confirmed:
 *
 *   - Pending bookings (deposit paid, 4-hour accept clock running) — URGENT
 *   - Open inquiries (need a quote)
 *   - Sent quotes (waiting on the customer to pay the deposit)
 *
 * Each row is tappable, navigates to the inquiry detail page where
 * the creator can act. Sections render only when they have items
 * so the card stays compact when there's nothing in-flight.
 *
 * Rendered on /orders inside the OrdersClient — already a creator
 * surface the user opens daily. Eliminates the "I sent a quote
 * three days ago and forgot about it" problem.
 */
export function CateringInflightCard({
  inflight,
}: {
  inflight: CateringInflight;
}) {
  const total =
    inflight.openInquiries.length +
    inflight.sentQuotes.length +
    inflight.pendingBookings.length;
  if (total === 0) return null;

  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-white/[0.10] bg-gradient-to-b from-amber-900/[0.10] to-transparent"
      aria-label="Catering in flight"
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Inbox size={16} className="text-amber-300" />
        <h2 className="text-sm font-bold text-white">Catering — in flight</h2>
        <span className="ml-auto text-[11px] font-semibold text-white/40">
          {total}
        </span>
      </header>

      {/* Pending bookings first — these have a 4hr clock. URGENT. */}
      {inflight.pendingBookings.length > 0 && (
        <Bucket
          tone="urgent"
          title="Deposit paid — accept now"
          subtitle="4-hour window before auto-decline"
          icon={<Clock size={14} />}
          items={inflight.pendingBookings}
          showDeadline="acceptDeadline"
        />
      )}

      {inflight.openInquiries.length > 0 && (
        <Bucket
          tone="open"
          title="New inquiries"
          subtitle="Send back a quote"
          icon={<Inbox size={14} />}
          items={inflight.openInquiries}
        />
      )}

      {inflight.sentQuotes.length > 0 && (
        <Bucket
          tone="sent"
          title="Quotes sent"
          subtitle="Waiting on the customer's deposit"
          icon={<FileText size={14} />}
          items={inflight.sentQuotes}
          showDeadline="quoteExpiresAt"
        />
      )}
    </section>
  );
}

type Tone = "urgent" | "open" | "sent";

const TONE_STYLES: Record<Tone, { label: string; row: string }> = {
  urgent: {
    label: "bg-red-900/40 text-red-200 ring-1 ring-inset ring-red-400/30",
    row: "hover:bg-red-900/[0.12]",
  },
  open: {
    label: "bg-amber-900/40 text-amber-200 ring-1 ring-inset ring-amber-400/30",
    row: "hover:bg-amber-900/[0.10]",
  },
  sent: {
    label: "bg-blue-900/40 text-blue-200 ring-1 ring-inset ring-blue-400/30",
    row: "hover:bg-blue-900/[0.10]",
  },
};

function Bucket({
  tone,
  title,
  subtitle,
  icon,
  items,
  showDeadline,
}: {
  tone: Tone;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: CateringInflightItem[];
  showDeadline?: "acceptDeadline" | "quoteExpiresAt";
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider ${styles.label}`}
        >
          {icon}
          {title}
        </span>
        <span className="text-[11px] text-white/45">{subtitle}</span>
      </div>
      <ul className="px-2 py-1">
        {items.map((item) => (
          <li key={item.inquiryId}>
            <Link
              href={`/catering/inquiries/${item.inquiryId}`}
              className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${styles.row}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {item.customerName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
                  <span>{formatEventDate(item.eventDate, item.eventTime)}</span>
                  <span aria-hidden>·</span>
                  <Users size={10} aria-hidden />
                  <span>{item.guestCount} guests</span>
                  {showDeadline === "acceptDeadline" && item.acceptDeadline && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-semibold text-red-300">
                        {formatCountdown(item.acceptDeadline)} left to accept
                      </span>
                    </>
                  )}
                  {showDeadline === "quoteExpiresAt" && item.quoteExpiresAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-blue-300/85">
                        expires {formatShortDate(item.quoteExpiresAt)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {item.totalCents !== null && (
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/85">
                  ${Math.round(item.totalCents / 100)}
                </span>
              )}
              <ChevronRight size={16} className="shrink-0 text-white/35" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatEventDate(date: string, time: string | null): string {
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!time) return label;
  const t = new Date(`2000-01-01T${time}`);
  const tlabel = t.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${label} · ${tlabel}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Returns "Xh Ym" or "Xm" until the deadline. Returns "expired"
 *  if the deadline has passed (shouldn't render in practice — the
 *  cron auto-declines past-deadline bookings — but defensive). */
function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}
