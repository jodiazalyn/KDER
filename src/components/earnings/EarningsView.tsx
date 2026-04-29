"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { BalanceHero } from "./BalanceHero";
import { ExpressLoginLinkButton } from "./ExpressLoginLinkButton";
import { FailedPayoutBanner } from "./FailedPayoutBanner";
import { HowEarningsWorkAccordion } from "./HowEarningsWorkAccordion";
import { InstantPayoutSheet } from "./InstantPayoutSheet";
import { KycBanner } from "./KycBanner";
import { LifetimeStatsCard } from "./LifetimeStatsCard";
import { OrderTransferDrawer } from "./OrderTransferDrawer";
import { PayoutHistoryList } from "./PayoutHistoryList";
import { PayoutScheduleSheet } from "./PayoutScheduleSheet";
import { TransactionRow } from "./TransactionRow";
import { getInstantPayoutState } from "@/lib/earnings-instant";
import type {
  EarningsData,
  EarningsTransaction,
} from "@/lib/earnings-types";

interface EarningsViewProps {
  initial: EarningsData;
}

export function EarningsView({ initial }: EarningsViewProps) {
  // Suspense wraps useSearchParams() per Next 15 requirement.
  return (
    <Suspense fallback={null}>
      <EarningsViewContent initial={initial} />
    </Suspense>
  );
}

function EarningsViewContent({ initial }: EarningsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showInstantSheet, setShowInstantSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [activeTransaction, setActiveTransaction] =
    useState<EarningsTransaction | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const refreshedOnceRef = useRef(false);

  const {
    hasConnectAccount,
    balance,
    payouts,
    account,
    lifetime,
    transactions,
    errors,
  } = initial;

  const availableCents = balance?.availableCents ?? 0;
  const instantPayoutState = getInstantPayoutState({ balance, account });

  const startConnectOnboarding = useCallback(async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/v1/creators/connect/onboard", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json?.data?.url) {
        toast.error(
          json?.error || "Couldn't start Stripe setup. Try again in a moment."
        );
        setConnectLoading(false);
        return;
      }
      window.location.href = json.data.url;
    } catch {
      toast.error("Couldn't reach Stripe. Check your connection.");
      setConnectLoading(false);
    }
  }, []);

  // Handle return-from-Stripe query params
  useEffect(() => {
    const connectParam = searchParams.get("connect");
    if (!connectParam) return;

    if (connectParam === "complete") {
      toast.success("Payouts set up! You can now activate plates.");
      router.replace("/earnings");
      router.refresh();
    } else if (connectParam === "refresh" && !refreshedOnceRef.current) {
      refreshedOnceRef.current = true;
      startConnectOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <main className="px-4 pb-4 pt-6">
      <h1 className="text-3xl font-black text-white">Earnings</h1>

      <div className="mt-4 space-y-4">
        <KycBanner
          hasConnectAccount={hasConnectAccount}
          account={account}
          loading={connectLoading}
          onResume={startConnectOnboarding}
        />

        {hasConnectAccount && <FailedPayoutBanner payouts={payouts} />}

        {/* Balance Hero */}
        <BalanceHero
          balance={balance}
          account={account}
          errorCode={errors.balance}
          onPayoutSuccess={() => router.refresh()}
          onInstantPayout={() => {
            if (availableCents <= 0) {
              toast.error("No balance available for payout.");
              return;
            }
            // Sheet handles every non-available state (no debit card,
            // not approved by Stripe yet) with an in-sheet explainer
            // instead of a verbose toast. See InstantPayoutSheet.
            setShowInstantSheet(true);
          }}
        />

        {/* Lifetime Stats */}
        {hasConnectAccount && (
          <LifetimeStatsCard
            lifetime={lifetime}
            errorCode={errors.lifetime}
          />
        )}

        {/* Payout History */}
        {hasConnectAccount && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-white/80">Payouts</h2>
            <PayoutHistoryList
              payouts={payouts}
              errorCode={errors.payouts}
            />
          </div>
        )}

        {/* Payout schedule row */}
        {hasConnectAccount && account && (
          <button
            type="button"
            onClick={() => setShowScheduleSheet(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 text-left active:bg-white/[0.06] transition-colors"
          >
            <div className="flex items-center gap-3">
              <CalendarClock size={18} className="text-white/60" />
              <div>
                <p className="text-sm font-medium text-white">
                  Payout schedule
                </p>
                <p className="text-xs text-white/50">
                  {account.schedule.interval === "manual"
                    ? "Manual — pull on demand"
                    : account.schedule.interval === "weekly"
                      ? `Weekly · ${account.schedule.weeklyAnchor ?? "monday"}`
                      : "Daily — every business day"}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/40" />
          </button>
        )}

        {/* Manage in Stripe */}
        {hasConnectAccount && <ExpressLoginLinkButton />}

        {/* Transaction list */}
        <div>
          <h2
            className="mb-3 text-lg font-bold text-green-300"
            style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
          >
            Transactions
          </h2>

          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onClick={() => setActiveTransaction(tx)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 pt-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
                <DollarSign size={28} className="text-white/20" />
              </div>
              <p className="text-center text-sm text-white/50">
                No earnings yet. Complete your first order to see your balance
                here.
              </p>
            </div>
          )}
        </div>

        <HowEarningsWorkAccordion />
      </div>

      <InstantPayoutSheet
        open={showInstantSheet}
        onOpenChange={setShowInstantSheet}
        availableCents={availableCents}
        state={instantPayoutState}
        onSuccess={() => router.refresh()}
      />

      {account && (
        <PayoutScheduleSheet
          open={showScheduleSheet}
          onOpenChange={setShowScheduleSheet}
          currentInterval={account.schedule.interval}
          currentWeeklyAnchor={account.schedule.weeklyAnchor}
          onSuccess={() => router.refresh()}
        />
      )}

      <OrderTransferDrawer
        open={activeTransaction !== null}
        onOpenChange={(o) => {
          if (!o) setActiveTransaction(null);
        }}
        transaction={activeTransaction}
      />
    </main>
  );
}
