"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NOT_ENABLED_STRIPE_CODES } from "@/lib/earnings-instant";
import type { InstantPayoutState } from "@/lib/earnings-types";

interface InstantPayoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Available balance the creator can pull. Cents. */
  availableCents: number;
  /**
   * Pre-flight state derived from balance + account. The sheet picks
   * which view to render based on this — and may switch to `not_enabled`
   * post-tap if Stripe rejects with a known limit code.
   */
  state: InstantPayoutState;
  /** Called after a successful payout so the parent can refresh. */
  onSuccess: () => void;
}

const INSTANT_FEE_PERCENT = 0.015; // Stripe US instant payout fee.
const STRIPE_SUPPORT_URL = "https://support.stripe.com/contact/email";

type ViewKind = "confirm" | "no_debit_card" | "not_enabled";

export function InstantPayoutSheet({
  open,
  onOpenChange,
  availableCents,
  state,
  onSuccess,
}: InstantPayoutSheetProps) {
  // Initial view picked from pre-flight state. Post-tap errors can
  // override (e.g. confirm → not_enabled if Stripe says limit exceeded).
  const [view, setView] = useState<ViewKind>(viewForState(state));
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Reset view + mint a fresh idempotency key whenever the sheet opens
  // or the underlying pre-flight state changes.
  useEffect(() => {
    if (!open) return;
    setView(viewForState(state));
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `kder_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
  }, [open, state]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            {view === "confirm"
              ? "Instant Payout"
              : view === "no_debit_card"
                ? "Add a debit card"
                : "Instant payouts not available yet"}
          </SheetTitle>
        </SheetHeader>

        {view === "confirm" ? (
          <ConfirmView
            availableCents={availableCents}
            idempotencyKey={idempotencyKey}
            submitting={submitting}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirm}
          />
        ) : view === "no_debit_card" ? (
          <NoDebitCardView onClose={() => onOpenChange(false)} />
        ) : (
          <NotEnabledView onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/payments/payouts/instant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ amount_cents: availableCents }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string | undefined = json?.code;
        // Post-tap fallback: if Stripe rejects with a known "instant
        // not enabled" code, swap the sheet into the explainer view
        // rather than dumping the verbose Stripe message in a toast.
        if (code && NOT_ENABLED_STRIPE_CODES.has(code)) {
          setView("not_enabled");
          setSubmitting(false);
          return;
        }
        const codeSuffix = code ? ` [${code}]` : "";
        toast.error(`${json?.error ?? "Instant payout failed"}${codeSuffix}`);
        setSubmitting(false);
        return;
      }
      onOpenChange(false);
      const fee = Math.round(availableCents * INSTANT_FEE_PERCENT);
      const net = availableCents - fee;
      toast.success(
        `Instant payout of $${(net / 100).toFixed(2)} initiated. Funds arrive within 30 minutes.`
      );
      onSuccess();
    } catch (err) {
      console.error("[InstantPayoutSheet] network error:", err);
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }
}

function viewForState(state: InstantPayoutState): ViewKind {
  if (state.kind === "no_debit_card") return "no_debit_card";
  if (state.kind === "not_enabled") return "not_enabled";
  // `available` and `no_balance` both default to confirm — `no_balance`
  // shouldn't happen in practice (button hidden) but if someone routes
  // here directly, the confirm UI's amount=0 guard handles it.
  return "confirm";
}

// ── Confirm view ──────────────────────────────────────────────

function ConfirmView({
  availableCents,
  idempotencyKey: _idempotencyKey,
  submitting,
  onCancel,
  onConfirm,
}: {
  availableCents: number;
  idempotencyKey: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { feeCents, payoutCents } = useMemo(() => {
    const fee = Math.round(availableCents * INSTANT_FEE_PERCENT);
    return { feeCents: fee, payoutCents: availableCents - fee };
  }, [availableCents]);

  return (
    <div className="mt-4 space-y-4 pb-6">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Available balance</span>
          <span className="text-white">
            ${(availableCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Instant fee (1.5%)</span>
          <span className="text-red-400">
            −${(feeCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="h-px bg-white/[0.08]" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">
            You&apos;ll receive
          </span>
          <span
            className="text-xl font-bold text-green-300"
            style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }}
          >
            ${(payoutCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <p className="text-xs text-white/40 text-center">
        Funds arrive within 30 minutes to your linked debit card. Fee may
        vary by region or balance.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform disabled:opacity-60"
        >
          {submitting ? "Confirming…" : "Confirm Payout"}
        </button>
      </div>
    </div>
  );
}

// ── No debit card view ────────────────────────────────────────

function NoDebitCardView({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-4 space-y-5 pb-6">
      <p className="text-sm text-white/80">
        Instant payouts go straight to a debit card linked to your bank
        account — funds usually land in under 30 minutes.
      </p>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          Two payout options once you add a card
        </p>
        <PayoutOption
          icon={<Zap size={16} className="text-yellow-300" />}
          title="Instant"
          subtitle="1.5% fee · arrives in ~30 min"
        />
        <div className="h-px bg-white/[0.06]" />
        <PayoutOption
          icon={<TrendingUp size={16} className="text-green-300" />}
          title="Standard"
          subtitle="Free · arrives in 2-3 business days"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          How to add a debit card
        </p>
        <ol className="mt-2 space-y-2 text-xs text-white/70">
          <li>
            <span className="font-bold text-white">1.</span> Tap{" "}
            <span className="font-medium text-white">Open Stripe</span> below.
          </li>
          <li>
            <span className="font-bold text-white">2.</span> In the Stripe
            dashboard, go to{" "}
            <span className="font-medium text-white">Payouts</span> →{" "}
            <span className="font-medium text-white">Bank account</span>.
          </li>
          <li>
            <span className="font-bold text-white">3.</span> Tap{" "}
            <span className="font-medium text-white">Add new</span> and pick{" "}
            <span className="font-medium text-white">Debit card</span>.
          </li>
          <li>
            <span className="font-bold text-white">4.</span> Come back to KDER
            — instant payouts will be available.
          </li>
        </ol>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
        >
          Close
        </button>
        <OpenStripeButton label="Open Stripe">
          <CreditCard size={14} />
        </OpenStripeButton>
      </div>
    </div>
  );
}

// ── Not enabled view ──────────────────────────────────────────

function NotEnabledView({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-4 space-y-5 pb-6">
      <p className="text-sm text-white/80">
        Stripe hasn&apos;t turned on instant payouts for your account yet.
        Your money is safe — it&apos;ll go out on the standard schedule
        instead.
      </p>

      {/* Visual: standard payout timeline */}
      <div className="rounded-2xl border border-green-400/[0.18] bg-green-900/[0.10] p-4">
        <p className="text-[11px] uppercase tracking-wider text-green-300/70">
          What happens to your money
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <TimelineStep label="Today" sublabel="Order paid" active />
          <TimelineArrow />
          <TimelineStep
            label="2-3 days"
            sublabel="Stripe ACH"
            active
          />
          <TimelineArrow />
          <TimelineStep label="Bank" sublabel="Funds land" active />
        </div>
        <p className="mt-3 text-[11px] text-white/50">
          Standard payouts are free and run automatically on your schedule.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <div className="flex items-start gap-2">
          <Info
            size={14}
            className="mt-0.5 flex-shrink-0 text-white/40"
          />
          <div className="text-xs text-white/70 space-y-2">
            <p>
              <span className="font-bold text-white">Why is this?</span>{" "}
              Stripe enables instant payouts after your account has
              processed enough orders for their risk system to score it.
              This is automatic — no action needed from you.
            </p>
            <p>
              <span className="font-bold text-white">When will it open?</span>{" "}
              Usually after a few hundred dollars of successful payments
              over a couple weeks. There&apos;s no exact threshold Stripe
              publishes.
            </p>
            <p>
              <span className="font-bold text-white">Need it sooner?</span>{" "}
              Reach out to Stripe support and ask them to review instant
              payout eligibility on your Connect account.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={STRIPE_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[0.15] text-sm font-bold text-white hover:bg-white/[0.20] active:scale-95 transition-all"
        >
          Email Stripe Support
          <ExternalLink size={12} />
        </a>
        <OpenStripeButton label="Open Stripe Dashboard">
          <ExternalLink size={14} />
        </OpenStripeButton>
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Shared subcomponents ──────────────────────────────────────

function OpenStripeButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/creators/connect/login-link", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.data?.url) {
        const code = json?.code ? ` [${json.code}]` : "";
        toast.error(`${json?.error ?? "Couldn't open Stripe"}${code}`);
        setLoading(false);
        return;
      }
      window.open(json.data.url, "_blank", "noopener");
    } catch {
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform disabled:opacity-60"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
      {label}
    </button>
  );
}

function PayoutOption({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-[11px] text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

function TimelineStep({
  label,
  sublabel,
  active,
}: {
  label: string;
  sublabel: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-lg border p-2 text-center ${active ? "border-green-400/30 bg-green-900/20" : "border-white/[0.08] bg-white/[0.04]"}`}
    >
      <p className="text-[11px] font-bold text-white">{label}</p>
      <p className="text-[9px] text-white/50">{sublabel}</p>
    </div>
  );
}

function TimelineArrow() {
  return <span className="text-white/30 text-xs">→</span>;
}
