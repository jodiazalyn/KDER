import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Super Dashboard metrics loader.
 *
 * Pulls the slim columns it needs from every domain table with a
 * SERVICE-ROLE client (caller must already be proven an admin via
 * requireAdmin) and computes all aggregates in JS. We aggregate in
 * memory rather than via SQL views/RPC because:
 *   - KDER is early-stage: row counts are in the hundreds/low-thousands,
 *     so a handful of column-projected selects are cheap and the JS math
 *     is instant.
 *   - It keeps every metric definition in one readable, type-checked
 *     place instead of scattered SQL strings the generated types don't
 *     know about.
 *
 * All money is normalized to DOLLARS as a number. orders.* money columns
 * are NUMERIC dollars; catering_* and payouts/disputes are *_cents ints.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

const DAY_MS = 86_400_000;

/** Inclusive day-count window helpers, all relative to "now". */
function sinceDays(n: number): number {
  return Date.now() - n * DAY_MS;
}

function isAfter(iso: string | null | undefined, ms: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= ms;
}

/** YYYY-MM-DD in UTC for daily bucketing. */
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Build an ordered array of the last `days` day-keys ending today. */
function lastNDayKeys(days: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  }
  return keys;
}

export interface TimePoint {
  day: string; // YYYY-MM-DD
  value: number;
}

export interface Bucket {
  label: string;
  count: number;
  amount?: number; // dollars, optional
}

export interface SuperMetrics {
  generatedAt: string;

  // ── Headline KPIs ──────────────────────────────────────────────
  kpis: {
    gmv: number; // dollars, paid orders + catering confirmed
    platformRevenue: number; // dollars, KDER's cut
    takeRatePct: number | null; // platformRevenue / orders GMV
    ordersTotal: number;
    ordersPaid: number;
    members: number;
    creators: number;
    activeListings: number;
    gmv30d: number;
    orders30d: number;
    signups30d: number;
  };

  // ── Users ──────────────────────────────────────────────────────
  users: {
    total: number;
    creators: number;
    customers: number;
    withEmail: number;
    new7d: number;
    new30d: number;
    signupsTrend: TimePoint[]; // last 30 days
  };

  // ── Creators ───────────────────────────────────────────────────
  creators: {
    total: number;
    byKyc: Bucket[];
    payoutsEnabled: number;
    storefrontActive: number;
    withReviews: number;
    avgRating: number | null;
    topByRating: { name: string; rating: number; count: number }[];
  };

  // ── Listings / plates ──────────────────────────────────────────
  listings: {
    total: number;
    plates: number;
    catering: number;
    activePlates: number;
    byStatus: Bucket[];
    byFulfillment: Bucket[];
    topCategories: Bucket[];
    topPlates: { name: string; orders: number; price: number }[];
  };

  // ── Orders ─────────────────────────────────────────────────────
  orders: {
    total: number;
    paid: number;
    byStatus: Bucket[];
    byFulfillment: Bucket[];
    avgOrderValue: number | null;
    revenueTrend: TimePoint[]; // last 30 days, dollars by paid_at
    receiptConfirmed: number;
    receiptProblems: number;
  };

  // ── Money ──────────────────────────────────────────────────────
  money: {
    gmv: number;
    platformRevenue: number;
    creatorPayouts: number;
    deliveryFees: number; // uber fees collected, dollars
    payoutsPaid: number; // dollars actually paid out via Stripe
    payoutsPending: number;
    disputesOpen: number;
    disputesAmount: number; // dollars
  };

  // ── Delivery (Uber Direct) ─────────────────────────────────────
  delivery: {
    deliveryOrders: number;
    booked: number;
    delivered: number;
    inProgress: number;
    bookingFailures: number;
    byStatus: Bucket[];
  };

  // ── Catering ───────────────────────────────────────────────────
  catering: {
    inquiries: number;
    inquiriesByStatus: Bucket[];
    quotesSent: number;
    quotesAccepted: number;
    quoteAcceptRatePct: number | null;
    bookings: number;
    bookingsByStatus: Bucket[];
    confirmedRevenue: number; // dollars
    depositsCollected: number; // dollars
    upcomingEvents: number;
  };

  // ── Locations ──────────────────────────────────────────────────
  locations: {
    topCreatorZips: Bucket[]; // creator service coverage
    topOrderCities: Bucket[]; // delivery dropoff cities
  };

  // ── Reviews ────────────────────────────────────────────────────
  reviews: {
    total: number;
    average: number | null;
    distribution: Bucket[]; // 5★ → 1★
  };
}

// Lightweight row shapes (we only select these columns).
type MemberRow = { role: string | null; email: string | null; created_at: string };
type MemberEmbed = { display_name: string | null; handle: string | null };
type CreatorRow = {
  kyc_status: string | null;
  payouts_enabled: boolean | null;
  storefront_active: boolean | null;
  service_zip_codes: string[] | null;
  review_count: number | null;
  review_rating_avg: number | null;
  legal_name: string | null;
  // Supabase infers embedded to-one relations as arrays; at runtime a
  // single-FK embed comes back as an object. Accept both and normalize.
  member: MemberEmbed | MemberEmbed[] | null;
};

/** Read a to-one embedded relation that may arrive as object or array. */
function embed(m: MemberEmbed | MemberEmbed[] | null): MemberEmbed | null {
  if (!m) return null;
  return Array.isArray(m) ? (m[0] ?? null) : m;
}
type ListingRow = {
  name: string | null;
  kind: string | null;
  status: string | null;
  fulfillment_type: string | null;
  price: number | null;
  order_count: number | null;
  category_tags: string[] | null;
};
type OrderRow = {
  status: string | null;
  fulfillment_type: string | null;
  total_amount: number | null;
  platform_fee: number | null;
  creator_payout: number | null;
  paid_at: string | null;
  created_at: string;
  uber_status: string | null;
  uber_delivery_id: string | null;
  uber_fee_cents: number | null;
  uber_booking_error: string | null;
  dropoff_instructions: string | null;
  receipt_status: string | null;
};
type CateringInquiryRow = { status: string | null };
type CateringQuoteRow = { status: string | null };
type CateringBookingRow = {
  status: string | null;
  total_cents: number | null;
  deposit_cents: number | null;
  balance_charged_at: string | null;
  event_date: string | null;
};
type PayoutRow = { status: string | null; amount: number | null; amount_cents: number | null };
type DisputeRow = { status: string | null; amount_cents: number | null };
type ReviewRow = { rating: number | null };

/** Count rows into labeled buckets, sorted by count desc. */
function tally(
  rows: { key: string | null | undefined }[]
): Bucket[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r.key ?? "unknown") || "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function loadSuperMetrics(service: DB): Promise<SuperMetrics> {
  // Fetch slim projections from every domain in parallel.
  const [
    membersRes,
    creatorsRes,
    listingsRes,
    ordersRes,
    inquiriesRes,
    quotesRes,
    bookingsRes,
    payoutsRes,
    disputesRes,
    reviewsRes,
  ] = await Promise.all([
    service.from("members").select("role, email, created_at"),
    service
      .from("creators")
      .select(
        "kyc_status, payouts_enabled, storefront_active, service_zip_codes, review_count, review_rating_avg, legal_name, member:members(display_name, handle)"
      ),
    service
      .from("listings")
      .select("name, kind, status, fulfillment_type, price, order_count, category_tags"),
    service
      .from("orders")
      .select(
        "status, fulfillment_type, total_amount, platform_fee, creator_payout, paid_at, created_at, uber_status, uber_delivery_id, uber_fee_cents, uber_booking_error, dropoff_instructions, receipt_status"
      ),
    service.from("catering_inquiries").select("status"),
    service.from("catering_quotes").select("status"),
    service
      .from("catering_bookings")
      .select("status, total_cents, deposit_cents, balance_charged_at, event_date"),
    service.from("payouts").select("status, amount, amount_cents"),
    service.from("disputes").select("status, amount_cents"),
    service.from("order_reviews").select("rating"),
  ]);

  const members = (membersRes.data ?? []) as MemberRow[];
  const creators = (creatorsRes.data ?? []) as unknown as CreatorRow[];
  const listings = (listingsRes.data ?? []) as ListingRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];
  const inquiries = (inquiriesRes.data ?? []) as CateringInquiryRow[];
  const quotes = (quotesRes.data ?? []) as CateringQuoteRow[];
  const bookings = (bookingsRes.data ?? []) as CateringBookingRow[];
  const payouts = (payoutsRes.data ?? []) as PayoutRow[];
  const disputes = (disputesRes.data ?? []) as DisputeRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];

  const ms7 = sinceDays(7);
  const ms30 = sinceDays(30);

  // ── Users ──────────────────────────────────────────────────────
  const customers = members.filter((m) => m.role !== "creator").length;
  const creatorMembers = members.filter((m) => m.role === "creator").length;
  const signupDayBuckets = new Map<string, number>();
  for (const m of members) {
    if (isAfter(m.created_at, ms30)) {
      const k = dayKey(m.created_at);
      signupDayBuckets.set(k, (signupDayBuckets.get(k) ?? 0) + 1);
    }
  }
  const signupsTrend: TimePoint[] = lastNDayKeys(30).map((day) => ({
    day,
    value: signupDayBuckets.get(day) ?? 0,
  }));

  // ── Orders + money ─────────────────────────────────────────────
  const PAID_STATUSES = new Set(["accepted", "ready", "completed"]);
  const paidOrders = orders.filter((o) => o.paid_at || PAID_STATUSES.has(o.status ?? ""));
  const ordersGmv = paidOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const platformRevenue = paidOrders.reduce((s, o) => s + (o.platform_fee ?? 0), 0);
  const creatorPayoutsAccrued = paidOrders.reduce((s, o) => s + (o.creator_payout ?? 0), 0);
  const deliveryFees =
    orders.reduce((s, o) => s + (o.uber_fee_cents ?? 0), 0) / 100;

  const revenueDayBuckets = new Map<string, number>();
  for (const o of orders) {
    if (o.paid_at && isAfter(o.paid_at, ms30)) {
      const k = dayKey(o.paid_at);
      revenueDayBuckets.set(k, (revenueDayBuckets.get(k) ?? 0) + (o.total_amount ?? 0));
    }
  }
  const revenueTrend: TimePoint[] = lastNDayKeys(30).map((day) => ({
    day,
    value: round2(revenueDayBuckets.get(day) ?? 0),
  }));
  const gmv30d = revenueTrend.reduce((s, p) => s + p.value, 0);
  const orders30d = orders.filter((o) => o.paid_at && isAfter(o.paid_at, ms30)).length;

  // ── Catering money ─────────────────────────────────────────────
  const confirmedBookings = bookings.filter(
    (b) => b.status && !["cancelled", "pending_acceptance"].includes(b.status)
  );
  const cateringRevenue =
    confirmedBookings.reduce((s, b) => s + (b.total_cents ?? 0), 0) / 100;
  const cateringDeposits =
    bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((s, b) => s + (b.deposit_cents ?? 0), 0) / 100;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingEvents = bookings.filter(
    (b) =>
      b.event_date &&
      b.event_date >= todayKey &&
      b.status &&
      ["confirmed", "balance_paid", "balance_due"].includes(b.status)
  ).length;

  // ── Payouts / disputes ─────────────────────────────────────────
  const payoutAmt = (p: PayoutRow) =>
    p.amount != null ? p.amount : (p.amount_cents ?? 0) / 100;
  const payoutsPaid = payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + payoutAmt(p), 0);
  const payoutsPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + payoutAmt(p), 0);
  const openDisputes = disputes.filter(
    (d) => d.status && !["won", "lost", "closed"].includes(d.status)
  );

  // ── Delivery ───────────────────────────────────────────────────
  const deliveryOrders = orders.filter(
    (o) => o.fulfillment_type === "delivery" || o.fulfillment_type === "both"
  );
  const deliveryStatusRows = deliveryOrders
    .filter((o) => o.uber_status)
    .map((o) => ({ key: o.uber_status }));
  const delivered = deliveryOrders.filter((o) => o.uber_status === "delivered").length;
  const booked = deliveryOrders.filter((o) => o.uber_delivery_id).length;
  const inProgress = deliveryOrders.filter(
    (o) =>
      o.uber_status &&
      ["pending", "pickup", "pickup_complete", "dropoff"].includes(o.uber_status)
  ).length;
  const bookingFailures = orders.filter((o) => o.uber_booking_error).length;

  // ── Locations ──────────────────────────────────────────────────
  const zipCounts = new Map<string, number>();
  for (const c of creators) {
    for (const z of c.service_zip_codes ?? []) {
      const zip = (z ?? "").trim();
      if (zip) zipCounts.set(zip, (zipCounts.get(zip) ?? 0) + 1);
    }
  }
  const topCreatorZips: Bucket[] = [...zipCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const cityCounts = new Map<string, number>();
  for (const o of orders) {
    if (!o.dropoff_instructions) continue;
    try {
      const parsed = JSON.parse(o.dropoff_instructions) as {
        city?: string;
        state?: string;
      };
      const city = (parsed.city ?? "").trim();
      if (city) {
        const label = parsed.state ? `${city}, ${parsed.state}` : city;
        cityCounts.set(label, (cityCounts.get(label) ?? 0) + 1);
      }
    } catch {
      // Free-text or legacy dropoff — skip.
    }
  }
  const topOrderCities: Bucket[] = [...cityCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Listings ───────────────────────────────────────────────────
  const plates = listings.filter((l) => (l.kind ?? "plate") === "plate");
  const cateringListings = listings.filter((l) => l.kind === "catering");
  const activePlates = plates.filter((l) => l.status === "active").length;
  const categoryRows: { key: string }[] = [];
  for (const l of listings) {
    for (const t of l.category_tags ?? []) {
      if (t) categoryRows.push({ key: t });
    }
  }
  const topPlates = [...plates]
    .sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0))
    .slice(0, 10)
    .filter((l) => (l.order_count ?? 0) > 0)
    .map((l) => ({
      name: l.name ?? "Untitled",
      orders: l.order_count ?? 0,
      price: l.price ?? 0,
    }));

  // ── Reviews ────────────────────────────────────────────────────
  const ratedReviews = reviews.filter((r) => r.rating != null);
  const reviewAvg =
    ratedReviews.length > 0
      ? round2(
          ratedReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / ratedReviews.length
        )
      : null;
  const distribution: Bucket[] = [5, 4, 3, 2, 1].map((star) => ({
    label: `${star}★`,
    count: ratedReviews.filter((r) => r.rating === star).length,
  }));

  // ── Creators ───────────────────────────────────────────────────
  const topByRating = [...creators]
    .filter((c) => (c.review_count ?? 0) > 0 && c.review_rating_avg != null)
    .sort((a, b) => (b.review_rating_avg ?? 0) - (a.review_rating_avg ?? 0))
    .slice(0, 8)
    .map((c) => {
      const mem = embed(c.member);
      return {
        name: mem?.display_name || mem?.handle || c.legal_name || "Creator",
        rating: c.review_rating_avg ?? 0,
        count: c.review_count ?? 0,
      };
    });
  const creatorAvgRating = (() => {
    const rated = creators.filter((c) => c.review_rating_avg != null);
    if (rated.length === 0) return null;
    return round2(
      rated.reduce((s, c) => s + (c.review_rating_avg ?? 0), 0) / rated.length
    );
  })();

  const quotesSent = quotes.filter((q) =>
    ["sent", "accepted", "declined", "expired", "superseded"].includes(q.status ?? "")
  ).length;
  const quotesAccepted = quotes.filter((q) => q.status === "accepted").length;

  return {
    generatedAt: new Date().toISOString(),

    kpis: {
      gmv: round2(ordersGmv + cateringRevenue),
      platformRevenue: round2(platformRevenue),
      takeRatePct: ordersGmv > 0 ? round2((platformRevenue / ordersGmv) * 100) : null,
      ordersTotal: orders.length,
      ordersPaid: paidOrders.length,
      members: members.length,
      creators: creators.length,
      activeListings: activePlates,
      gmv30d: round2(gmv30d),
      orders30d,
      signups30d: members.filter((m) => isAfter(m.created_at, ms30)).length,
    },

    users: {
      total: members.length,
      creators: creatorMembers,
      customers,
      withEmail: members.filter((m) => m.email).length,
      new7d: members.filter((m) => isAfter(m.created_at, ms7)).length,
      new30d: members.filter((m) => isAfter(m.created_at, ms30)).length,
      signupsTrend,
    },

    creators: {
      total: creators.length,
      byKyc: tally(creators.map((c) => ({ key: c.kyc_status }))),
      payoutsEnabled: creators.filter((c) => c.payouts_enabled).length,
      storefrontActive: creators.filter((c) => c.storefront_active).length,
      withReviews: creators.filter((c) => (c.review_count ?? 0) > 0).length,
      avgRating: creatorAvgRating,
      topByRating,
    },

    listings: {
      total: listings.length,
      plates: plates.length,
      catering: cateringListings.length,
      activePlates,
      byStatus: tally(listings.map((l) => ({ key: l.status }))),
      byFulfillment: tally(listings.map((l) => ({ key: l.fulfillment_type }))),
      topCategories: tally(categoryRows.map((r) => ({ key: r.key }))).slice(0, 12),
      topPlates,
    },

    orders: {
      total: orders.length,
      paid: paidOrders.length,
      byStatus: tally(orders.map((o) => ({ key: o.status }))),
      byFulfillment: tally(orders.map((o) => ({ key: o.fulfillment_type }))),
      avgOrderValue:
        paidOrders.length > 0 ? round2(ordersGmv / paidOrders.length) : null,
      revenueTrend,
      receiptConfirmed: orders.filter((o) => o.receipt_status === "received").length,
      receiptProblems: orders.filter((o) => o.receipt_status === "problem").length,
    },

    money: {
      gmv: round2(ordersGmv + cateringRevenue),
      platformRevenue: round2(platformRevenue),
      creatorPayouts: round2(creatorPayoutsAccrued),
      deliveryFees: round2(deliveryFees),
      payoutsPaid: round2(payoutsPaid),
      payoutsPending: round2(payoutsPending),
      disputesOpen: openDisputes.length,
      disputesAmount: round2(
        disputes.reduce((s, d) => s + (d.amount_cents ?? 0), 0) / 100
      ),
    },

    delivery: {
      deliveryOrders: deliveryOrders.length,
      booked,
      delivered,
      inProgress,
      bookingFailures,
      byStatus: tally(deliveryStatusRows),
    },

    catering: {
      inquiries: inquiries.length,
      inquiriesByStatus: tally(inquiries.map((i) => ({ key: i.status }))),
      quotesSent,
      quotesAccepted,
      quoteAcceptRatePct:
        quotesSent > 0 ? round2((quotesAccepted / quotesSent) * 100) : null,
      bookings: bookings.length,
      bookingsByStatus: tally(bookings.map((b) => ({ key: b.status }))),
      confirmedRevenue: round2(cateringRevenue),
      depositsCollected: round2(cateringDeposits),
      upcomingEvents,
    },

    locations: {
      topCreatorZips,
      topOrderCities,
    },

    reviews: {
      total: ratedReviews.length,
      average: reviewAvg,
      distribution,
    },
  };
}
