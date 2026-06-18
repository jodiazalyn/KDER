"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  bookingId: string;
  status:
    | "pending_acceptance"
    | "confirmed"
    | "balance_due"
    | "balance_paid"
    | "completed"
    | "cancelled";
}

/**
 * Sticky action bar for the booking detail page. State-aware:
 *   - balance_due → "Retry balance charge" (calls a manual-retry endpoint)
 *   - confirmed/balance_paid → "Mark complete" once the event has happened
 *   - completed → no actions (terminal)
 *   - cancelled → no actions
 *   - pending_acceptance → no actions (lives on inquiry detail page)
 */
export function BookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "complete" | "retry">(null);

  const markComplete = async () => {
    if (busy) return;
    if (!confirm("Mark this booking as complete? Both parties will be notified.")) return;
    setBusy("complete");
    try {
      const res = await fetch(
        `/api/v1/catering/bookings/${bookingId}/complete`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't mark complete.");
        return;
      }
      toast.success("Marked complete. Customer notified.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const retryBalance = async () => {
    if (busy) return;
    setBusy("retry");
    try {
      const res = await fetch(
        `/api/v1/catering/bookings/${bookingId}/retry-balance`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        // Charge failed (most common: card still declined). API
        // already updated the booking row + emailed the customer
        // a retry-card link, so just surface the reason here.
        toast.error(body?.error || "Charge still failed.");
        router.refresh();
        return;
      }
      toast.success("Balance charged successfully.");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  };

  // No actions for these terminal states.
  if (status === "completed" || status === "cancelled" || status === "pending_acceptance") {
    return null;
  }

  return (
    // Sit above the BottomNav (5rem + safe-area) so the action bar
    // isn't covered by it. Matches the InquiryActions fix — both used
    // to render behind the z-50 nav and were effectively invisible on
    // mobile. The nav owns its own safe-area padding, so we use a
    // flat py-3 here.
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border bg-background/85 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
      <div className="mx-auto flex max-w-lg gap-2">
        {status === "balance_due" && (
          <button
            type="button"
            onClick={retryBalance}
            disabled={!!busy}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
              busy === "retry"
                ? "cursor-wait bg-red-700/60"
                : "bg-red-700 shadow-[0_0_20px_rgba(185,28,28,0.4)] hover:bg-red-700/90"
            )}
          >
            {busy === "retry" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw size={16} />
                Retry balance charge
              </>
            )}
          </button>
        )}
        {(status === "confirmed" || status === "balance_paid") && (
          <button
            type="button"
            onClick={markComplete}
            disabled={!!busy}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95",
              busy === "complete"
                ? "cursor-wait bg-gradient-to-r from-[#22C55E] to-[#16A34A] opacity-60"
                : "bg-gradient-to-r from-[#22C55E] to-[#16A34A] shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
            )}
          >
            {busy === "complete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                Mark complete
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
