"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EarningsTransaction } from "@/lib/earnings-types";

interface OrderTransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: EarningsTransaction | null;
}

interface PaymentDetails {
  payment_intent_id: string | null;
  charge_id: string | null;
  transfer_id: string | null;
}

export function OrderTransferDrawer({
  open,
  onOpenChange,
  transaction,
}: OrderTransferDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            {transaction?.plateName ?? "Order"}
          </SheetTitle>
        </SheetHeader>

        {/* Key on transaction.id so state resets via remount when the
            user clicks a different transaction — no setState-in-effect. */}
        <DrawerBody
          key={transaction?.id ?? "none"}
          transaction={transaction}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  transaction,
  onClose,
}: {
  transaction: EarningsTransaction | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  // Initial loading state derived from prop; no setLoading(true) in effect body.
  const [loading, setLoading] = useState<boolean>(transaction !== null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction) return;
    let cancelled = false;
    fetch(`/api/v1/orders/${transaction.id}/payment-details`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setErrorCode(json?.code ?? "unknown_error");
          return;
        }
        setDetails(json.data as PaymentDetails);
      })
      .catch(() => {
        if (!cancelled) setErrorCode("network_error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transaction]);

  return (
    <div className="mt-4 space-y-4 pb-6">
      {transaction && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-2">
          <Row
            label="Customer"
            value={transaction.memberName}
            copyable={false}
          />
          <Row
            label="Order total"
            value={`$${(transaction.orderTotalCents / 100).toFixed(2)}`}
            copyable={false}
          />
          <Row
            label="KDER fee"
            value={`−$${(transaction.platformFeeCents / 100).toFixed(2)}`}
            copyable={false}
            accent="text-red-400"
          />
          <Row
            label="Your payout"
            value={`$${(transaction.netPayoutCents / 100).toFixed(2)}`}
            copyable={false}
            accent="text-green-300"
          />
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-white/40">
          Stripe IDs
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Loader2 size={12} className="animate-spin" />
            Loading payment details…
          </div>
        ) : errorCode ? (
          <p className="text-xs text-red-300">
            Couldn&apos;t load Stripe IDs [{errorCode}]
          </p>
        ) : details ? (
          <div className="space-y-2">
            <Row
              label="Order"
              value={transaction?.id ?? "—"}
              copyable
            />
            <Row
              label="Payment intent"
              value={details.payment_intent_id ?? "—"}
              copyable={Boolean(details.payment_intent_id)}
            />
            <Row
              label="Charge"
              value={details.charge_id ?? "—"}
              copyable={Boolean(details.charge_id)}
            />
            <Row
              label="Transfer"
              value={details.transfer_id ?? "—"}
              copyable={Boolean(details.transfer_id)}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-12 w-full items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white active:scale-95 transition-transform"
      >
        Close
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  copyable,
  accent = "text-white",
}: {
  label: string;
  value: string;
  copyable: boolean;
  accent?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/50">{label}</span>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!copyable}
        className={`flex items-center gap-1.5 ${accent} ${copyable ? "cursor-pointer hover:text-white" : "cursor-default"}`}
        title={copyable ? "Copy to clipboard" : undefined}
      >
        <span className="font-mono text-[11px]">{value}</span>
        {copyable &&
          (copied ? (
            <Check size={11} className="text-green-400" />
          ) : (
            <Copy size={11} className="opacity-50" />
          ))}
      </button>
    </div>
  );
}
