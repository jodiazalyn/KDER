"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Check, X, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuoteLite {
  id: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  expires_at: string;
}

interface BookingLite {
  id: string;
  status: string;
  accept_deadline: string | null;
}

interface Props {
  inquiryId: string;
  customerMemberId: string | null;
  customerName: string;
  quote: QuoteLite | null;
  booking: BookingLite | null;
}

function money(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Status-aware action bar + banners for the inquiry detail page.
 * Renders:
 *
 *   - When no quote yet     → "Build quote" CTA
 *   - When quote sent        → status banner + "Edit / Resend quote"
 *   - When booking pending  → Accept / Decline action buttons + 4h countdown
 *   - When booking confirmed → success banner + Calendar link
 *   - When cancelled         → muted banner
 *
 * Both the status banner (which renders ABOVE the action bar via a
 * portal-like absolute-positioned bar wouldn't work for SSR
 * compatibility) and the action bar live here as one component so
 * the state transitions stay in one place.
 */
export function InquiryActions({
  inquiryId,
  customerMemberId,
  customerName,
  quote,
  booking,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);

  const accept = async () => {
    if (!booking || busy) return;
    setBusy("accept");
    try {
      const res = await fetch(
        `/api/v1/catering/bookings/${booking.id}/accept`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't accept booking.");
        return;
      }
      toast.success(`Booking confirmed. ${customerName} has been notified.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    if (!booking || busy) return;
    if (
      !confirm(
        `Decline this booking? ${customerName}'s deposit will be refunded.`
      )
    ) {
      return;
    }
    setBusy("decline");
    try {
      const res = await fetch(
        `/api/v1/catering/bookings/${booking.id}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't decline booking.");
        return;
      }
      toast.success("Booking declined and deposit refunded.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* Status banner — renders just above the page bottom-padding so
          the sticky action bar doesn't overlap it. */}
      {(quote || booking) && (
        <div className="mx-auto max-w-lg px-4 pb-4 pt-2">
          {/* Booking takes precedence if it exists */}
          {booking?.status === "pending_acceptance" && (
            <Banner
              tone="amber"
              title="Deposit paid — accept within 4 hours"
              body={`${customerName} paid the deposit. Tap Accept below to confirm the booking, or Decline to refund. ${
                booking.accept_deadline
                  ? `Auto-declines at ${new Date(booking.accept_deadline).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}.`
                  : ""
              }`}
            />
          )}
          {booking?.status === "confirmed" && (
            <Banner
              tone="green"
              title="Booking confirmed"
              body={`The balance will auto-charge a few days before the event. View it on your Calendar.`}
            />
          )}
          {booking?.status === "cancelled" && (
            <Banner
              tone="muted"
              title="Booking cancelled"
              body="The deposit has been refunded."
            />
          )}
          {/* If no booking but a quote exists, show quote status */}
          {!booking && quote?.status === "sent" && (
            <Banner
              tone="blue"
              title={`Quote sent — ${money(quote.total_cents)}`}
              body={`Awaiting deposit of ${money(quote.deposit_cents)}. Expires ${new Date(quote.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}
            />
          )}
          {!booking && quote?.status === "expired" && (
            <Banner
              tone="red"
              title="Quote expired"
              body="The customer didn't pay the deposit in time. You can build and send a new quote."
            />
          )}
          {!booking && quote?.status === "declined" && (
            <Banner
              tone="muted"
              title="Quote declined"
              body="The customer declined this quote."
            />
          )}
        </div>
      )}

      {/* Sticky action bar — positioned ABOVE the BottomNav so it
          isn't covered. The BottomNav lives at `bottom-0 z-50` and is
          ~80px tall (5rem), so we anchor at `bottom-[5rem+safe]`. The
          nav handles iOS safe-area below us, so we use a flat `py-3`
          here (the old `pb-[calc(0.75rem+safe)]` was double-padding).
          Bug history: the previous `bottom-0 z-40` placement put the
          bar directly under the z-50 nav — invisible on mobile, an
          early-tester reported the Message + Build quote buttons as
          "no buttons at all." */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/85 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto flex max-w-lg gap-2">
          {/* Pending acceptance: Accept + Decline. Quote stays read-only. */}
          {booking?.status === "pending_acceptance" ? (
            <>
              <button
                type="button"
                onClick={decline}
                disabled={!!busy}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-red-400/[0.30] text-sm font-semibold text-red-200 transition-colors active:scale-95 disabled:opacity-50",
                  busy === "decline" ? "" : "hover:bg-red-500/10"
                )}
              >
                {busy === "decline" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X size={16} />
                    Decline
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={!!busy}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
                  busy === "accept"
                    ? "cursor-wait bg-[#1B5E20]/60"
                    : "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
                )}
              >
                {busy === "accept" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check size={16} />
                    Accept booking
                  </>
                )}
              </button>
            </>
          ) : booking?.status === "confirmed" ? (
            /* Confirmed: only message + calendar */
            <>
              <Link
                href={
                  customerMemberId
                    ? `/messages/general_${customerMemberId}`
                    : "/messages"
                }
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.10] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] active:scale-95"
              >
                <MessageCircle size={16} />
                Message
              </Link>
              <Link
                href="/catering/calendar"
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.06] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.10] active:scale-95"
              >
                Open Calendar
              </Link>
            </>
          ) : (
            /* No booking yet: message + build (or edit/resend) quote */
            <>
              <Link
                href={
                  customerMemberId
                    ? `/messages/general_${customerMemberId}`
                    : "/messages"
                }
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.10] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] active:scale-95"
              >
                <MessageCircle size={16} />
                Message
              </Link>
              <Link
                href={`/catering/inquiries/${inquiryId}/quote`}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95"
              >
                <Sparkles size={16} />
                {quote?.status === "sent"
                  ? "Edit & resend"
                  : quote?.status === "expired" || quote?.status === "declined"
                    ? "Send new quote"
                    : "Build quote"}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "amber" | "green" | "blue" | "red" | "muted";
  title: string;
  body: string;
}) {
  const styles: Record<typeof tone, string> = {
    amber:
      "border-amber-400/[0.30] bg-amber-900/[0.20] text-amber-100",
    green:
      "border-green-400/[0.30] bg-green-900/[0.25] text-green-100",
    blue: "border-blue-400/[0.20] bg-blue-900/[0.20] text-blue-100",
    red: "border-red-400/[0.30] bg-red-900/[0.25] text-red-100",
    muted: "border-white/[0.10] bg-white/[0.04] text-white/70",
  };
  return (
    <div className={cn("rounded-2xl border p-4", styles[tone])}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-xs opacity-90">{body}</p>
    </div>
  );
}
