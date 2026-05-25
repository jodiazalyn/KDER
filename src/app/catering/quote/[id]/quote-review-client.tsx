"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuoteData {
  id: string;
  inquiry_id: string;
  creator_id: string;
  member_id: string;
  status: string;
  line_items: Array<{
    name: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
  }>;
  food_subtotal_cents: number;
  fees_cents: number;
  tax_cents: number;
  total_cents: number;
  deposit_cents: number;
  balance_cents: number;
  creator_notes: string | null;
  expires_at: string;
  inquiry: {
    event_date: string;
    event_time: string | null;
    guest_count: number;
    event_address: string | null;
  };
  creator: {
    member: {
      display_name: string;
      handle: string;
      photo_url: string | null;
    };
  };
}

interface Props {
  quote: QuoteData;
  paidParam: boolean;
  viewerRole: "creator" | "customer";
}

function money(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/** Tick down to the expiration time — runs only when more than an hour
 *  remains; otherwise the absolute time renders. */
function useCountdown(targetIso: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);
  const ms = new Date(targetIso).getTime() - now;
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const minutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  return `${minutes} min left`;
}

export function QuoteReviewClient({ quote, paidParam, viewerRole }: Props) {
  const [paying, setPaying] = useState(false);
  // `paidParam` is the Stripe success-redirect signal. Even if the
  // webhook hasn't fired yet to flip the quote status, the customer
  // sees a confirmation card immediately so the success URL feels
  // responsive — webhook just promotes to a real booking.
  const showSuccess = paidParam || quote.status === "accepted";

  const expiresLabel = useCountdown(quote.expires_at);
  const eventDateLabel = new Date(
    quote.inquiry.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTimeLabel = quote.inquiry.event_time
    ? new Date(`2000-01-01T${quote.inquiry.event_time}`).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit" }
      )
    : null;

  const isExpired = new Date(quote.expires_at) < new Date();
  const canPay =
    viewerRole === "customer" &&
    quote.status === "sent" &&
    !isExpired &&
    !showSuccess;

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const res = await fetch(
        `/api/v1/catering/quotes/${quote.id}/deposit-intent`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok || !body.data?.checkout_url) {
        toast.error(body?.error || "Couldn't start the deposit.");
        return;
      }
      // Stripe Checkout redirect.
      window.location.href = body.data.checkout_url;
    } catch {
      toast.error("Couldn't reach the payment server. Try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Header — creator avatar + name */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        {quote.creator.member.photo_url && (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <Image
              src={quote.creator.member.photo_url}
              alt=""
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-white">
            {quote.creator.member.display_name}
          </h1>
          <p className="truncate text-xs text-white/50">
            Catering quote
          </p>
        </div>
        {!showSuccess && !isExpired && (
          <span className="shrink-0 rounded-full bg-amber-900/40 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-300">
            {expiresLabel}
          </span>
        )}
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* Success state — webhook will promote the quote to accepted
            shortly, but render the success card immediately so the
            customer's redirect lands somewhere reassuring. */}
        {showSuccess && (
          <div className="flex items-start gap-3 rounded-2xl border border-green-400/[0.30] bg-green-900/[0.25] p-4">
            <CheckCircle2
              size={24}
              className="mt-0.5 shrink-0 text-green-300"
            />
            <div>
              <p className="text-sm font-bold text-green-100">
                Deposit received
              </p>
              <p className="mt-0.5 text-xs text-green-200/80">
                {quote.creator.member.display_name} has 4 hours to confirm
                your booking. We&apos;ll email you the moment they accept.
              </p>
            </div>
          </div>
        )}

        {/* Event facts */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Your event
          </h2>
          <ul className="space-y-2.5 text-sm">
            <Fact icon={CalendarDays} value={`${eventDateLabel}${eventTimeLabel ? ` · ${eventTimeLabel}` : ""}`} />
            <Fact icon={Users} value={`${quote.inquiry.guest_count} guests`} />
            {quote.inquiry.event_address && (
              <Fact icon={MapPin} value={quote.inquiry.event_address} />
            )}
          </ul>
        </section>

        {/* Line items */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
            What&apos;s included
          </h2>
          <ul className="space-y-2 text-sm">
            {quote.line_items.map((it, idx) => (
              <li
                key={idx}
                className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0"
              >
                <span className="min-w-0 text-white/90">
                  <span className="truncate">{it.name}</span>
                  {it.qty > 1 && (
                    <span className="ml-1.5 text-white/50">× {it.qty}</span>
                  )}
                </span>
                <span className="shrink-0 font-medium text-white">
                  {money(it.total_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Totals */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <ul className="space-y-1.5 text-sm">
            <TotalRow label="Food subtotal" value={money(quote.food_subtotal_cents)} />
            {quote.fees_cents > 0 && (
              <TotalRow
                label="Fees (delivery, labor)"
                value={money(quote.fees_cents)}
              />
            )}
            {quote.tax_cents > 0 && (
              <TotalRow label="Tax" value={money(quote.tax_cents)} />
            )}
            <li className="my-2 h-px bg-white/[0.06]" />
            <TotalRow
              label="Total"
              value={money(quote.total_cents)}
              bold
            />
            <TotalRow
              label="Due now (deposit)"
              value={money(quote.deposit_cents)}
              accent
            />
            <TotalRow
              label="Balance (charged before event)"
              value={money(quote.balance_cents)}
              muted
            />
          </ul>
        </section>

        {/* Creator notes */}
        {quote.creator_notes && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Notes from {quote.creator.member.display_name}
            </h2>
            <p className="whitespace-pre-wrap text-sm text-white/80">
              {quote.creator_notes}
            </p>
          </section>
        )}

        {/* Status messaging */}
        {isExpired && !showSuccess && (
          <div className="rounded-2xl border border-red-400/[0.30] bg-red-900/[0.25] p-4 text-sm text-red-200">
            This quote has expired. Reach out to {quote.creator.member.display_name}{" "}
            to request a new one.
          </div>
        )}
        {viewerRole === "creator" && !showSuccess && (
          <div className="rounded-2xl border border-blue-400/[0.20] bg-blue-900/[0.20] p-3 text-xs text-blue-200">
            You&apos;re viewing this as the creator. The customer sees the
            same page with a &ldquo;Pay Deposit&rdquo; button instead of this note.
          </div>
        )}
      </div>

      {/* Sticky pay bar — customer only, only when payable */}
      {canPay && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px] backdrop-saturate-[180%]">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handlePay}
              disabled={paying}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-all active:scale-95",
                paying
                  ? "cursor-wait bg-[#1B5E20]/60"
                  : "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              )}
            >
              {paying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Starting deposit…
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  Pay {money(quote.deposit_cents)} deposit
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-white/40">
              Card saved for the {money(quote.balance_cents)} balance, charged
              before the event.
            </p>
          </div>
        </div>
      )}

      {/* If accepted, show a back-link instead of the pay bar */}
      {showSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px]">
          <div className="mx-auto max-w-lg">
            <Link
              href="/"
              className="flex h-12 w-full items-center justify-center rounded-full border border-white/[0.10] text-sm font-semibold text-white/80 transition-all hover:bg-white/[0.06] active:scale-95"
            >
              Back to KDER
            </Link>
          </div>
        </div>
      )}
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

function TotalRow({
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
        className={cn(
          "text-sm",
          bold && "font-bold text-white",
          accent && "text-green-300",
          muted && "text-white/50",
          !bold && !accent && !muted && "text-white/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
          bold && "text-base font-bold text-white",
          accent && "font-bold text-green-300",
          muted && "text-white/60",
          !bold && !accent && !muted && "text-white/90"
        )}
      >
        {value}
      </span>
    </li>
  );
}
