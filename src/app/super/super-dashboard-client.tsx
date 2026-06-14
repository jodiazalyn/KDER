"use client";

import { useMemo } from "react";
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
} from "lucide-react";
import type { SuperMetrics, Bucket, TimePoint } from "@/lib/admin/metrics";

/* ────────────────────────────────────────────────────────────────
 * KDER Super Dashboard — cofounder control room.
 *
 * One scrollable page of sections: headline KPIs, then per-domain
 * panels (users, money, orders, plates, delivery, catering, locations,
 * reviews). Everything is computed server-side and passed in; this
 * component is pure presentation + a CSV export of the snapshot.
 * ──────────────────────────────────────────────────────────────── */

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const moneyExact = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => n.toLocaleString("en-US");

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
          <button
            type="button"
            onClick={handleExport}
            className="glass-btn-pill flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white transition-all hover:bg-white/[0.10] active:scale-[0.98]"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* ── Headline KPIs ──────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            icon={<DollarSign size={16} />}
            label="GMV (all-time)"
            value={money(m.kpis.gmv)}
            sub={`${money(m.kpis.gmv30d)} last 30d`}
            accent="emerald"
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
          />
          <Kpi
            icon={<ShoppingBag size={16} />}
            label="Orders"
            value={num(m.kpis.ordersTotal)}
            sub={`${num(m.kpis.ordersPaid)} paid · ${num(m.kpis.orders30d)} in 30d`}
          />
          <Kpi
            icon={<Users size={16} />}
            label="Members"
            value={num(m.kpis.members)}
            sub={`${num(m.kpis.signups30d)} new in 30d`}
          />
          <Kpi
            icon={<Store size={16} />}
            label="Creators"
            value={num(m.kpis.creators)}
          />
          <Kpi
            icon={<UtensilsCrossed size={16} />}
            label="Active plates"
            value={num(m.kpis.activeListings)}
          />
          <Kpi
            icon={<PartyPopper size={16} />}
            label="Catering revenue"
            value={money(m.catering.confirmedRevenue)}
            sub={`${num(m.catering.bookings)} bookings`}
          />
          <Kpi
            icon={<Truck size={16} />}
            label="Delivery fees"
            value={money(m.money.deliveryFees)}
            sub={`${num(m.delivery.delivered)} delivered`}
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
    </main>
  );
}

/* ── Presentational primitives ──────────────────────────────────── */

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald";
}) {
  return (
    <div className="glass-card rounded-glass-lg p-4">
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
      <p className="mt-3 text-2xl font-black leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
      {sub && <p className="mt-1 text-[11px] text-white/35">{sub}</p>}
    </div>
  );
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
