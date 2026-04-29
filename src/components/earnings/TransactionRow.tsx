"use client";

import type { EarningsTransaction } from "@/lib/earnings-types";

const STATUS_STYLE: Record<
  EarningsTransaction["status"],
  { label: string; className: string }
> = {
  paid: { label: "Paid", className: "bg-green-900/50 text-green-300" },
  pending: {
    label: "Pending",
    className: "bg-orange-900/40 text-orange-300",
  },
  held: { label: "Held", className: "bg-white/10 text-white/50" },
  refunded: { label: "Refunded", className: "bg-red-900/50 text-red-300" },
};

interface TransactionRowProps {
  transaction: EarningsTransaction;
  onClick?: () => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const status = STATUS_STYLE[transaction.status];
  const date = new Date(transaction.date);
  const isRefunded = transaction.status === "refunded";

  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`block w-full text-left rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] ${onClick ? "active:bg-white/[0.10] transition-colors" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {transaction.plateName}
          </p>
          <p className="text-xs text-white/40">{transaction.memberName}</p>
        </div>
        {isRefunded ? (
          <span className="text-base font-bold text-red-400 flex-shrink-0">
            −${(transaction.refundAmountCents / 100).toFixed(2)}
          </span>
        ) : (
          <span
            className="text-base font-bold text-green-300 flex-shrink-0"
            style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
          >
            +${(transaction.netPayoutCents / 100).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          <span>
            {date.toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>·</span>
          <span title="10% platform fee — keeps KDER running for creators">
            ${(transaction.orderTotalCents / 100).toFixed(2)} − $
            {(transaction.platformFeeCents / 100).toFixed(2)} fee
          </span>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>
    </Wrapper>
  );
}
