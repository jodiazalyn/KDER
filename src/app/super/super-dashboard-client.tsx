"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Store,
  ShoppingBag,
  DollarSign,
  UtensilsCrossed,
  Truck,
  PartyPopper,
  Star,
  MapPin,
  Download,
  TrendingUp,
  AlertTriangle,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { SuperAgentPanel } from "./agent/SuperAgentPanel";
import type {
  SuperMetrics,
  Bucket,
  TimePoint,
  OrderDetail,
  MemberDetail,
  CreatorDetail,
  ListingDetail,
} from "@/lib/admin/metrics";

/* ────────────────────────────────────────────────────────────────
 * KDER Super Dashboard — cofounder control room.
 *
 * One scrollable page of sections: headline KPIs, then per-domain
 * panels (users, money, orders, plates, delivery, catering, locations,
 * reviews). Everything is computed server-side and passed in.
 *
 * Each headline KPI is now clickable → opens a drill-down modal with
 * the row-level records behind the number (the actual orders, members,
 * creators, listings) plus the relevant breakdowns. The creators
 * drill-down doubles as the recruitment/activation view: handles, where
 * each creator is stuck, and how the pipeline is filling over time.
 * ──────────────────────────────────────────────────────────────── */

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const moneyExact = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => n.toLocaleString("en-US");
const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
      })
    : "—";

/** Which headline card's drill-down is open. */
type DrillKey =
  | "gmv"
  | "platform"
  | "orders"
  | "members"
  | "creators"
  | "plates"
  | "catering"
  | "delivery";

export function SuperDashboardClient({
  metrics,
  adminEmail,
}: {
  metrics: SuperMetrics;
  adminEmail: string;
}) {
  const generated = useMemo(
    () =>
      new Date(metrics.generatedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [metrics.generatedAt]
  );

  const [drill, setDrill] = useState<DrillKey | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const handleExport = () => downloadCsv(metrics);

  const m = metrics;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0A0A] via-[#0D1A0D] to-[#0A0A0A] pb-24 text-white">
      <div className="mx-auto max-w-5xl px-4 pt-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              KDER · Internal
            </p>
            <h1 className="mt-1 text-3xl font-black leading-none">Super Dashboard</h1>
            <p className="mt-2 text-xs text-white/40">
              Live snapshot · {generated} · {adminEmail}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAgentOpen(true)}
              className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(34,197,94,0.35)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Sparkles size={15} />
              Cleopatra VII
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="glass-btn-pill flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-white/35">
          Tip: tap any card below to drill into the underlying records.
        </p>

        {/* ── Headline KPIs (clickable) ──────────────────────── */}
        <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            icon={<DollarSign size={16} />}
            label="GMV (all-time)"
            value={money(m.kpis.gmv)}
            sub={`${money(m.kpis.gmv30d)} last 30d`}
            accent="emerald"
            onClick={() => setDrill("gmv")}
          />
          <Kpi
            icon={<TrendingUp size={16} />}
            label="Platform revenue"
            value={money(m.kpis.platformRevenue)}
            sub={
              m.kpis.takeRatePct != null
                ? `${m.kpis.takeRatePct}% take rate`
                : "—"
            }
            accent="emerald"
            onClick={() => setDrill("platform")}
          />
          <Kpi
            icon={<ShoppingBag size={16} />}
            label="Orders"
            value={num(m.kpis.ordersTotal)}
            sub={`${num(m.kpis.ordersPaid)} paid · ${num(m.kpis.orders30d)} in 30d`}
            onClick={() => setDrill("orders")}
          />
          <Kpi
            icon={<Users size={16} />}
            label="Members"
            value={num(m.kpis.members)}
            sub={`${num(m.kpis.signups30d)} new in 30d`}
            onClick={() => setDrill("members")}
          />
          <Kpi
            icon={<Store size={16} />}
            label="Creators"
            value={num(m.kpis.creators)}
            sub={
              m.creators.needsAttention > 0
                ? `${num(m.creators.needsAttention)} need attention`
                : "all active"
            }
            onClick={() => setDrill("creators")}
          />
          <Kpi
            icon={<UtensilsCrossed size={16} />}
            label="Active plates"
            value={num(m.kpis.activeListings)}
            onClick={() => setDrill("plates")}
          />
          <Kpi
            icon={<PartyPopper size={16} />}
            label="Catering revenue"
            value={money(m.catering.confirmedRevenue)}
            sub={`${num(m.catering.bookings)} bookings`}
            onClick={() => setDrill("catering")}
          />
          <Kpi
            icon={<Truck size={16} />}
            label="Delivery fees"
            value={money(m.money.deliveryFees)}
            sub={`${num(m.delivery.delivered)} delivered`}
            onClick={() => setDrill("delivery")}
          />
        </section>

        {/* ── Trends ─────────────────────────────────────────── */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Section title="Revenue · last 30 days" icon={<DollarSign size={15} />}>
            <Sparkline points={m.orders.revenueTrend} format={(v) => money(v)} color="#34d399" />
          </Section>
          <Section title="Signups · last 30 days" icon={<Users size={15} />}>
            <Sparkline points={m.users.signupsTrend} format={(v) => num(v)} color="#60a5fa" />
          </Section>
        </div>

        {/* ── Money ──────────────────────────────────────────── */}
        <Section title="Money" icon={<DollarSign size={15} />} className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Mini label="GMV" value={moneyExact(m.money.gmv)} />
            <Mini label="Platform revenue" value={moneyExact(m.money.platformRevenue)} />
            <Mini label="Creator payouts (accrued)" value={moneyExact(m.money.creatorPayouts)} />
            <Mini label="Payouts paid (Stripe)" value={moneyExact(m.money.payoutsPaid)} />
            <Mini label="Payouts pending" value={moneyExact(m.money.payoutsPending)} />
            <Mini label="Avg order value" value={m.orders.avgOrderValue != null ? moneyExact(m.orders.avgOrderValue) : "—"} />
            <Mini label="Catering deposits" value={moneyExact(m.catering.depositsCollected)} />
            <Mini label="Delivery fees" value={moneyExact(m.money.deliveryFees)} />
            <Mini
              label="Open disputes"
              value={`${num(m.money.disputesOpen)} · ${moneyExact(m.money.disputesAmount)}`}
              warn={m.money.disputesOpen > 0}
            />
          </div>
        </Section>

        {/* ── Users + Creators ───────────────────────────────── */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Section title="Users" icon={<Users size={15} />}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Total members" value={num(m.users.total)} />
              <Mini label="Creators" value={num(m.users.creators)} />
              <Mini label="Customers" value={num(m.users.customers)} />
              <Mini label="With email" value={num(m.users.withEmail)} />
              <Mini label="New · 7d" value={num(m.users.new7d)} />
              <Mini label="New · 30d" value={num(m.users.new30d)} />
            </div>
          </Section>
          <Section title="Creators" icon={<Store size={15} />}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Payouts enabled" value={num(m.creators.payoutsEnabled)} />
              <Mini label="Storefront active" value={num(m.creators.storefrontActive)} />
              <Mini label="With reviews" value={num(m.creators.withReviews)} />
              <Mini
                label="Avg rating"
                value={m.creators.avgRating != null ? `${m.creators.avgRating}★` : "—"}
              />
            </div>
            <BarList title="KYC status" buckets={m.creators.byKyc} className="mt-3" />
          </Section>
        </div>

        {/* ── Orders ─────────────────────────────────────────── */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Section title="Orders by status" icon={<ShoppingBag size={15} />}>
            <BarList buckets={m.orders.byStatus} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Mini label="Receipt confirmed" value={num(m.orders.receiptConfirmed)} />
              <Mini label="Reported problems" value={num(m.orders.receiptProblems)} warn={m.orders.receiptProblems > 0} />
            </div>
          </Section>
          <Section title="Orders by fulfillment" icon={<Truck size={15} />}>
            <BarList buckets={m.orders.byFulfillment} />
          </Section>
        </div>

        {/* ── Plates ─────────────────────────────────────────── */}
        <Section title="Plates & listings" icon={<UtensilsCrossed size={15} />} className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Total listings" value={num(m.listings.total)} />
            <Mini label="Plates" value={num(m.listings.plates)} />
            <Mini label="Catering listings" value={num(m.listings.catering)} />
            <Mini label="Active plates" value={num(m.listings.activePlates)} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <BarList title="By status" buckets={m.listings.byStatus} />
            <BarList title="By fulfillment" buckets={m.listings.byFulfillment} />
          </div>
          {m.listings.topCategories.length > 0 && (
            <BarList title="Top categories" buckets={m.listings.topCategories} className="mt-3" />
          )}
          {m.listings.topPlates.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Top plates by orders
              </p>
              <div className="space-y-1">
                {m.listings.topPlates.map((p, i) => (
                  <Row
                    key={`${p.name}-${i}`}
                    left={p.name}
                    right={`${num(p.orders)} orders · ${moneyExact(p.price)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Delivery ───────────────────────────────────────── */}
        <Section title="Delivery (Uber Direct)" icon={<Truck size={15} />} className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Mini label="Delivery orders" value={num(m.delivery.deliveryOrders)} />
            <Mini label="Booked" value={num(m.delivery.booked)} />
            <Mini label="Delivered" value={num(m.delivery.delivered)} />
            <Mini label="In progress" value={num(m.delivery.inProgress)} />
            <Mini
              label="Booking failures"
              value={num(m.delivery.bookingFailures)}
              warn={m.delivery.bookingFailures > 0}
            />
          </div>
          {m.delivery.byStatus.length > 0 && (
            <BarList title="By Uber status" buckets={m.delivery.byStatus} className="mt-3" />
          )}
        </Section>

        {/* ── Catering ───────────────────────────────────────── */}
        <Section title="Catering pipeline" icon={<PartyPopper size={15} />} className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Inquiries" value={num(m.catering.inquiries)} />
            <Mini label="Quotes sent" value={num(m.catering.quotesSent)} />
            <Mini
              label="Quote accept rate"
              value={m.catering.quoteAcceptRatePct != null ? `${m.catering.quoteAcceptRatePct}%` : "—"}
            />
            <Mini label="Upcoming events" value={num(m.catering.upcomingEvents)} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <BarList title="Inquiries by status" buckets={m.catering.inquiriesByStatus} />
            <BarList title="Bookings by status" buckets={m.catering.bookingsByStatus} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Mini label="Confirmed revenue" value={moneyExact(m.catering.confirmedRevenue)} />
            <Mini label="Deposits collected" value={moneyExact(m.catering.depositsCollected)} />
          </div>
        </Section>

        {/* ── Locations ──────────────────────────────────────── */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Section title="Top creator coverage (ZIP)" icon={<MapPin size={15} />}>
            {m.locations.topCreatorZips.length > 0 ? (
              <BarList buckets={m.locations.topCreatorZips} />
            ) : (
              <Empty>No creator service ZIPs set yet.</Empty>
            )}
          </Section>
          <Section title="Top delivery cities" icon={<MapPin size={15} />}>
            {m.locations.topOrderCities.length > 0 ? (
              <BarList buckets={m.locations.topOrderCities} />
            ) : (
              <Empty>No delivery dropoffs recorded yet.</Empty>
            )}
          </Section>
        </div>

        {/* ── Reviews ────────────────────────────────────────── */}
        <Section title="Reviews" icon={<Star size={15} />} className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Total reviews" value={num(m.reviews.total)} />
            <Mini
              label="Average rating"
              value={m.reviews.average != null ? `${m.reviews.average}★` : "—"}
            />
          </div>
          {m.reviews.total > 0 && (
            <BarList buckets={m.reviews.distribution} className="mt-3" />
          )}
        </Section>

        <p className="mt-8 text-center text-[11px] text-white/25">
          Internal tool · figures reflect live data at load time · not indexed
        </p>
      </div>

      {/* ── Drill-down modal ─────────────────────────────────── */}
      {drill && (
        <DrillModal title={drillTitle(drill)} onClose={() => setDrill(null)}>
          <DrillBody drill={drill} m={m} />
        </DrillModal>
      )}

      <SuperAgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </main>
  );
}

/* ── Drill-down content ─────────────────────────────────────────── */

function drillTitle(drill: DrillKey): string {
  switch (drill) {
    case "gmv":
      return "GMV — orders behind the number";
    case "platform":
      return "Platform revenue — fees by order";
    case "orders":
      return "Orders";
    case "members":
      return "Members";
    case "creators":
      return "Creators — activation & recruitment";
    case "plates":
      return "Plates & listings";
    case "catering":
      return "Catering pipeline";
    case "delivery":
      return "Delivery (Uber Direct)";
  }
}

function DrillBody({ drill, m }: { drill: DrillKey; m: SuperMetrics }) {
  switch (drill) {
    case "gmv":
      return (
        <>
          <MiniRow>
            <Mini label="GMV (all-time)" value={moneyExact(m.money.gmv)} />
            <Mini label="GMV (30d)" value={moneyExact(m.kpis.gmv30d)} />
            <Mini label="Avg order value" value={m.orders.avgOrderValue != null ? moneyExact(m.orders.avgOrderValue) : "—"} />
            <Mini label="Paid orders" value={num(m.kpis.ordersPaid)} />
          </MiniRow>
          <Sparkline points={m.orders.revenueTrend} format={(v) => money(v)} color="#34d399" />
          <OrdersTable orders={m.details.orders} />
        </>
      );
    case "platform":
      return (
        <>
          <MiniRow>
            <Mini label="Platform revenue" value={moneyExact(m.money.platformRevenue)} />
            <Mini label="Take rate" value={m.kpis.takeRatePct != null ? `${m.kpis.takeRatePct}%` : "—"} />
            <Mini label="Creator payouts (accrued)" value={moneyExact(m.money.creatorPayouts)} />
          </MiniRow>
          <OrdersTable orders={m.details.orders} />
        </>
      );
    case "orders":
      return (
        <>
          <MiniRow>
            <Mini label="Total" value={num(m.orders.total)} />
            <Mini label="Paid" value={num(m.orders.paid)} />
            <Mini label="In 30d" value={num(m.kpis.orders30d)} />
            <Mini label="Receipt problems" value={num(m.orders.receiptProblems)} warn={m.orders.receiptProblems > 0} />
          </MiniRow>
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList title="By status" buckets={m.orders.byStatus} />
            <BarList title="By fulfillment" buckets={m.orders.byFulfillment} />
          </div>
          <OrdersTable orders={m.details.orders} />
        </>
      );
    case "members":
      return (
        <>
          <MiniRow>
            <Mini label="Total members" value={num(m.users.total)} />
            <Mini label="Customers" value={num(m.users.customers)} />
            <Mini label="Creators" value={num(m.users.creators)} />
            <Mini label="New · 7d" value={num(m.users.new7d)} />
            <Mini label="New · 30d" value={num(m.users.new30d)} />
            <Mini label="With email" value={num(m.users.withEmail)} />
          </MiniRow>
          <Section title="Signups · last 30 days" icon={<Users size={15} />}>
            <Sparkline points={m.users.signupsTrend} format={(v) => num(v)} color="#60a5fa" />
          </Section>
          <MembersTable members={m.details.members} />
        </>
      );
    case "creators":
      return <CreatorsDrill m={m} />;
    case "plates":
      return (
        <>
          <MiniRow>
            <Mini label="Total listings" value={num(m.listings.total)} />
            <Mini label="Plates" value={num(m.listings.plates)} />
            <Mini label="Active plates" value={num(m.listings.activePlates)} />
            <Mini label="Catering listings" value={num(m.listings.catering)} />
          </MiniRow>
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList title="By status" buckets={m.listings.byStatus} />
            <BarList title="By fulfillment" buckets={m.listings.byFulfillment} />
          </div>
          {m.listings.topCategories.length > 0 && (
            <BarList title="Top categories" buckets={m.listings.topCategories} />
          )}
          <ListingsTable listings={m.details.listings} />
        </>
      );
    case "catering":
      return (
        <>
          <MiniRow>
            <Mini label="Inquiries" value={num(m.catering.inquiries)} />
            <Mini label="Quotes sent" value={num(m.catering.quotesSent)} />
            <Mini label="Quote accept rate" value={m.catering.quoteAcceptRatePct != null ? `${m.catering.quoteAcceptRatePct}%` : "—"} />
            <Mini label="Bookings" value={num(m.catering.bookings)} />
            <Mini label="Confirmed revenue" value={moneyExact(m.catering.confirmedRevenue)} />
            <Mini label="Deposits collected" value={moneyExact(m.catering.depositsCollected)} />
            <Mini label="Upcoming events" value={num(m.catering.upcomingEvents)} />
          </MiniRow>
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList title="Inquiries by status" buckets={m.catering.inquiriesByStatus} />
            <BarList title="Bookings by status" buckets={m.catering.bookingsByStatus} />
          </div>
        </>
      );
    case "delivery":
      return (
        <>
          <MiniRow>
            <Mini label="Delivery orders" value={num(m.delivery.deliveryOrders)} />
            <Mini label="Booked" value={num(m.delivery.booked)} />
            <Mini label="Delivered" value={num(m.delivery.delivered)} />
            <Mini label="In progress" value={num(m.delivery.inProgress)} />
            <Mini label="Booking failures" value={num(m.delivery.bookingFailures)} warn={m.delivery.bookingFailures > 0} />
            <Mini label="Delivery fees" value={moneyExact(m.money.deliveryFees)} />
          </MiniRow>
          {m.delivery.byStatus.length > 0 && (
            <BarList title="By Uber status" buckets={m.delivery.byStatus} />
          )}
          <OrdersTable
            orders={m.details.orders.filter(
              (o) => o.fulfillment === "delivery" || o.fulfillment === "both"
            )}
          />
        </>
      );
  }
}

/**
 * Creators drill-down = the recruitment + activation cockpit. Funnel
 * shows where the pipeline narrows; the table shows each creator's
 * handle, where they're stuck, and what they're actually selling so
 * cofounders know who to help. A toggle isolates the ones needing a nudge.
 */
function CreatorsDrill({ m }: { m: SuperMetrics }) {
  const [attentionOnly, setAttentionOnly] = useState(false);
  const rows = attentionOnly
    ? m.details.creators.filter((c) => c.stage !== "Active")
    : m.details.creators;

  return (
    <>
      <MiniRow>
        <Mini label="Total creators" value={num(m.creators.total)} />
        <Mini label="New · 7d" value={num(m.creators.new7d)} />
        <Mini label="New · 30d" value={num(m.creators.new30d)} />
        <Mini
          label="Need attention"
          value={num(m.creators.needsAttention)}
          warn={m.creators.needsAttention > 0}
        />
        <Mini label="Storefront active" value={num(m.creators.storefrontActive)} />
        <Mini label="Avg rating" value={m.creators.avgRating != null ? `${m.creators.avgRating}★` : "—"} />
      </MiniRow>

      <Section title="New creators · last 30 days" icon={<TrendingUp size={15} />}>
        <Sparkline points={m.creators.newTrend} format={(v) => num(v)} color="#a78bfa" />
      </Section>

      <Section title="Onboarding → selling funnel" icon={<Store size={15} />}>
        <BarList buckets={m.creators.funnel} />
        <p className="mt-2 text-[11px] text-white/35">
          Each step is where creators drop off — the biggest gap is where to focus.
        </p>
      </Section>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Creators ({num(rows.length)})
        </p>
        <button
          type="button"
          onClick={() => setAttentionOnly((v) => !v)}
          className={
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors " +
            (attentionOnly
              ? "bg-amber-500/20 text-amber-200"
              : "bg-white/[0.06] text-white/60 hover:bg-white/[0.10]")
          }
        >
          {attentionOnly ? "Showing: needs attention" : "Show needs attention only"}
        </button>
      </div>
      <CreatorsTable creators={rows} />
    </>
  );
}

/* ── Tables ──────────────────────────────────────────────────────── */

function TableShell({
  head,
  children,
  empty,
  rowCount,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  empty: string;
  rowCount: number;
}) {
  if (rowCount === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-white/40">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={"px-3 py-2 font-semibold " + (right ? "text-right" : "")}>{children}</th>
);
const Td = ({ children, right, dim }: { children: React.ReactNode; right?: boolean; dim?: boolean }) => (
  <td className={"px-3 py-2 " + (right ? "text-right tabular-nums " : "") + (dim ? "text-white/50" : "text-white/80")}>
    {children}
  </td>
);

function OrdersTable({ orders }: { orders: OrderDetail[] }) {
  return (
    <TableShell
      rowCount={orders.length}
      empty="No orders yet."
      head={
        <>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th>Type</Th>
          <Th right>Total</Th>
          <Th right>Fee</Th>
          <Th>Paid</Th>
          <Th>Courier</Th>
          <Th>City</Th>
        </>
      }
    >
      {orders.map((o) => (
        <tr key={o.id} className="border-b border-white/[0.04] last:border-0">
          <Td dim>{shortDate(o.createdAt)}</Td>
          <Td><span className="capitalize">{(o.status ?? "—").replace(/_/g, " ")}</span></Td>
          <Td dim><span className="capitalize">{(o.fulfillment ?? "—").replace(/_/g, " ")}</span></Td>
          <Td right>{moneyExact(o.total)}</Td>
          <Td right dim>{moneyExact(o.platformFee)}</Td>
          <Td>{o.paid ? <span className="text-emerald-300">✓</span> : <span className="text-white/30">—</span>}</Td>
          <Td dim><span className="capitalize">{(o.uberStatus ?? "—").replace(/_/g, " ")}</span></Td>
          <Td dim>{o.city ?? "—"}</Td>
        </tr>
      ))}
    </TableShell>
  );
}

function MembersTable({ members }: { members: MemberDetail[] }) {
  return (
    <TableShell
      rowCount={members.length}
      empty="No members yet."
      head={
        <>
          <Th>Joined</Th>
          <Th>Name</Th>
          <Th>Role</Th>
          <Th>Email</Th>
        </>
      }
    >
      {members.map((mem, i) => (
        <tr key={`${mem.email ?? mem.name ?? "m"}-${i}`} className="border-b border-white/[0.04] last:border-0">
          <Td dim>{shortDate(mem.createdAt)}</Td>
          <Td>{mem.name ?? "—"}</Td>
          <Td dim><span className="capitalize">{mem.role ?? "customer"}</span></Td>
          <Td dim>{mem.email ?? "—"}</Td>
        </tr>
      ))}
    </TableShell>
  );
}

function CreatorsTable({ creators }: { creators: CreatorDetail[] }) {
  return (
    <TableShell
      rowCount={creators.length}
      empty="No creators match."
      head={
        <>
          <Th>Creator</Th>
          <Th>Stage</Th>
          <Th right>GMV</Th>
          <Th right>Orders</Th>
          <Th right>Plates</Th>
          <Th right>Rating</Th>
          <Th>Joined</Th>
        </>
      }
    >
      {creators.map((c, i) => (
        <tr key={`${c.handle ?? c.name}-${i}`} className="border-b border-white/[0.04] last:border-0">
          <Td>
            <div className="font-medium text-white/90">{c.name}</div>
            {c.handle && <div className="text-[11px] text-white/40">@{c.handle}</div>}
          </Td>
          <Td><StageChip stage={c.stage} /></Td>
          <Td right>{moneyExact(c.gmv)}</Td>
          <Td right dim>{num(c.orders)}</Td>
          <Td right dim>{num(c.listings)}</Td>
          <Td right dim>{c.rating != null ? `${c.rating}★ (${num(c.reviews)})` : "—"}</Td>
          <Td dim>{shortDate(c.createdAt)}</Td>
        </tr>
      ))}
    </TableShell>
  );
}

function ListingsTable({ listings }: { listings: ListingDetail[] }) {
  return (
    <TableShell
      rowCount={listings.length}
      empty="No listings yet."
      head={
        <>
          <Th>Plate</Th>
          <Th>Kind</Th>
          <Th>Status</Th>
          <Th>Type</Th>
          <Th right>Price</Th>
          <Th right>Orders</Th>
        </>
      }
    >
      {listings.map((l, i) => (
        <tr key={`${l.name}-${i}`} className="border-b border-white/[0.04] last:border-0">
          <Td>{l.name}</Td>
          <Td dim><span className="capitalize">{l.kind ?? "plate"}</span></Td>
          <Td dim><span className="capitalize">{(l.status ?? "—").replace(/_/g, " ")}</span></Td>
          <Td dim><span className="capitalize">{(l.fulfillment ?? "—").replace(/_/g, " ")}</span></Td>
          <Td right>{moneyExact(l.price)}</Td>
          <Td right dim>{num(l.orders)}</Td>
        </tr>
      ))}
    </TableShell>
  );
}

function StageChip({ stage }: { stage: string }) {
  const tone =
    stage === "Active"
      ? "bg-emerald-500/20 text-emerald-200"
      : stage === "No orders yet"
        ? "bg-sky-500/20 text-sky-200"
        : stage === "No listings" || stage === "Storefront off"
          ? "bg-amber-500/20 text-amber-200"
          : stage === "Needs payouts"
            ? "bg-orange-500/20 text-orange-200"
            : "bg-rose-500/20 text-rose-200"; // Needs Stripe
  return (
    <span className={"inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold " + tone}>
      {stage}
    </span>
  );
}

/* ── Modal shell ─────────────────────────────────────────────────── */

function DrillModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-card my-2 w-full max-w-4xl rounded-glass-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-glass-lg border-b border-white/10 bg-[#0D1A0D]/90 px-5 py-4 backdrop-blur">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}

function MiniRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

/* ── Presentational primitives ──────────────────────────────────── */

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald";
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div
          className={
            "flex h-8 w-8 items-center justify-center rounded-full " +
            (accent === "emerald"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-white/[0.08] text-white/70")
          }
        >
          {icon}
        </div>
        {onClick && <ChevronRight size={15} className="text-white/25 transition-colors group-hover:text-white/60" />}
      </div>
      <p className="mt-3 text-2xl font-black leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
      {sub && <p className="mt-1 text-[11px] text-white/35">{sub}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group glass-card rounded-glass-lg p-4 text-left transition-all hover:bg-white/[0.06] hover:ring-1 hover:ring-emerald-400/30 active:scale-[0.99]"
      >
        {inner}
      </button>
    );
  }
  return <div className="glass-card rounded-glass-lg p-4">{inner}</div>;
}

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"glass-card rounded-glass-lg p-4 " + (className ?? "")}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-emerald-300/80">{icon}</span>}
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className={"text-lg font-bold leading-none " + (warn ? "text-amber-300" : "text-white")}>
        {warn && value !== "0" && <AlertTriangle size={13} className="mr-1 inline -translate-y-0.5" />}
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-white/40">{label}</p>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <span className="truncate pr-2 text-sm text-white/80">{left}</span>
      <span className="flex-shrink-0 text-xs font-medium text-white/50">{right}</span>
    </div>
  );
}

function BarList({
  buckets,
  title,
  className,
}: {
  buckets: Bucket[];
  title?: string;
  className?: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className={className}>
      {title && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          {title}
        </p>
      )}
      <div className="space-y-1.5">
        {buckets.length === 0 && <Empty>No data.</Empty>}
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-28 flex-shrink-0 truncate text-xs capitalize text-white/60">
              {b.label.replace(/_/g, " ")}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/90"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-white/70">
              {num(b.count)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs text-white/30">{children}</p>;
}

/**
 * Dependency-free sparkline: an SVG area+line over the time series. Keeps
 * the bundle lean (no charting lib) while giving a real 30-day shape.
 */
function Sparkline({
  points,
  format,
  color,
}: {
  points: TimePoint[];
  format: (v: number) => string;
  color: string;
}) {
  const W = 600;
  const H = 120;
  const pad = 6;
  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);
  const peak = Math.max(...values);
  const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = H - pad - (p.value / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = coords.length
    ? `${line} L${coords[coords.length - 1][0]},${H - pad} L${coords[0][0]},${H - pad} Z`
    : "";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-black">{format(total)}</p>
        <p className="text-[11px] text-white/35">peak {format(peak)}/day</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#spark-${color})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/25">
        <span>{points[0]?.day.slice(5)}</span>
        <span>{points[points.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

/* ── CSV export ─────────────────────────────────────────────────── */

function downloadCsv(m: SuperMetrics) {
  const rows: [string, string | number][] = [
    ["Generated at", m.generatedAt],
    ["", ""],
    ["GMV (all-time)", m.kpis.gmv],
    ["GMV (30d)", m.kpis.gmv30d],
    ["Platform revenue", m.kpis.platformRevenue],
    ["Take rate %", m.kpis.takeRatePct ?? ""],
    ["Orders total", m.kpis.ordersTotal],
    ["Orders paid", m.kpis.ordersPaid],
    ["Orders (30d)", m.kpis.orders30d],
    ["Avg order value", m.orders.avgOrderValue ?? ""],
    ["", ""],
    ["Members total", m.users.total],
    ["Creators", m.users.creators],
    ["Customers", m.users.customers],
    ["With email", m.users.withEmail],
    ["New members (7d)", m.users.new7d],
    ["New members (30d)", m.users.new30d],
    ["", ""],
    ["Creators payouts enabled", m.creators.payoutsEnabled],
    ["Creators storefront active", m.creators.storefrontActive],
    ["Creators with reviews", m.creators.withReviews],
    ["Creators avg rating", m.creators.avgRating ?? ""],
    ["Creators new (7d)", m.creators.new7d],
    ["Creators new (30d)", m.creators.new30d],
    ["Creators need attention", m.creators.needsAttention],
    ["", ""],
    ["Creator payouts accrued", m.money.creatorPayouts],
    ["Payouts paid (Stripe)", m.money.payoutsPaid],
    ["Payouts pending", m.money.payoutsPending],
    ["Delivery fees", m.money.deliveryFees],
    ["Open disputes", m.money.disputesOpen],
    ["Disputes amount", m.money.disputesAmount],
    ["", ""],
    ["Listings total", m.listings.total],
    ["Plates", m.listings.plates],
    ["Catering listings", m.listings.catering],
    ["Active plates", m.listings.activePlates],
    ["", ""],
    ["Delivery orders", m.delivery.deliveryOrders],
    ["Delivered", m.delivery.delivered],
    ["In progress", m.delivery.inProgress],
    ["Booking failures", m.delivery.bookingFailures],
    ["", ""],
    ["Catering inquiries", m.catering.inquiries],
    ["Catering quotes sent", m.catering.quotesSent],
    ["Catering quote accept rate %", m.catering.quoteAcceptRatePct ?? ""],
    ["Catering bookings", m.catering.bookings],
    ["Catering confirmed revenue", m.catering.confirmedRevenue],
    ["Catering deposits collected", m.catering.depositsCollected],
    ["Catering upcoming events", m.catering.upcomingEvents],
    ["", ""],
    ["Reviews total", m.reviews.total],
    ["Reviews average", m.reviews.average ?? ""],
  ];

  const breakdowns: [string, Bucket[]][] = [
    ["Orders by status", m.orders.byStatus],
    ["Orders by fulfillment", m.orders.byFulfillment],
    ["Creators by KYC", m.creators.byKyc],
    ["Creator funnel", m.creators.funnel],
    ["Listings by status", m.listings.byStatus],
    ["Top categories", m.listings.topCategories],
    ["Catering inquiries by status", m.catering.inquiriesByStatus],
    ["Catering bookings by status", m.catering.bookingsByStatus],
    ["Top creator ZIPs", m.locations.topCreatorZips],
    ["Top delivery cities", m.locations.topOrderCities],
    ["Review distribution", m.reviews.distribution],
  ];
  for (const [title, buckets] of breakdowns) {
    rows.push(["", ""]);
    rows.push([title, "count"]);
    for (const b of buckets) rows.push([b.label, b.count]);
  }

  // Per-creator detail — the recruitment/activation worksheet.
  rows.push(["", ""]);
  rows.push(["Creator", "handle | stage | gmv | orders | plates | rating | reviews | joined"]);
  for (const c of m.details.creators) {
    rows.push([
      c.name,
      `${c.handle ? "@" + c.handle : "—"} | ${c.stage} | ${c.gmv} | ${c.orders} | ${c.listings} | ${c.rating ?? "—"} | ${c.reviews} | ${c.createdAt.slice(0, 10)}`,
    ]);
  }

  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv =
    "Metric,Value\n" + rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kder-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
