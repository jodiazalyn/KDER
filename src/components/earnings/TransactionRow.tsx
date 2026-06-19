"use client";

import type { EarningsTransaction } from "@/lib/earnings-types";

const STATUS_STYLE: Record<
  EarningsTransaction["status"],
  { label: string; className: string }
> = {
  paid: {
    label: "Paid",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:bg-green-900/50 dark:text-green-300",
  },
  pending: {
    label: "Pending",
    className:
      "bg-amber-500/10 text-amber-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  held: {
    label: "Held",
    className: "bg-muted text-muted-foreground",
  },
  refunded: {
    label: "Refunded",
    className: "bg-red-500/10 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
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
      className={`glass-card rounded-glass-lg block w-full text-left p-4 ${onClick ? "active:bg-muted/60 transition-colors" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {transaction.plateName}
          </p>
          <p className="text-xs text-muted-foreground">{transaction.memberName}</p>
        </div>
        {isRefunded ? (
          <span className="text-base font-bold text-red-600 dark:text-red-400 flex-shrink-0">
            −${(transaction.refundAmountCents / 100).toFixed(2)}
          </span>
        ) : (
          <span className="text-base font-bold text-emerald-600 dark:text-green-300 flex-shrink-0">
            +${(transaction.netPayoutCents / 100).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
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
