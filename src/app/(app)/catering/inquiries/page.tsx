import Link from "next/link";
import { Inbox, Users, Calendar } from "lucide-react";
import { requireCreator } from "@/lib/loaders/auth";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "open" | "quoted";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

/**
 * Creator's catering inquiry inbox.
 *
 * Shows open + quoted requests sorted by event-date proximity
 * (next event first). Filter tabs (All / Open / Quoted) let the
 * creator scope to "what's waiting on a quote" vs "quotes I sent
 * that are waiting on a deposit" — the latter being the surface
 * we were missing before, where creators were losing track of
 * sent quotes during the deposit-pay window.
 *
 * Tabs are URL-driven (`?status=quoted`) so the page stays a
 * Server Component — no client island needed.
 */
export default async function CateringInquiriesPage({
  searchParams,
}: PageProps) {
  const { supabase, creator } = await requireCreator();
  const { status } = await searchParams;
  const filter: StatusFilter =
    status === "open" || status === "quoted" ? status : "all";

  // Pull both statuses; tab badges read off the full set, the
  // visible list is filtered client-render via the URL filter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiries } = await (supabase as any)
    .from("catering_inquiries")
    .select(`
      id, event_date, event_time, guest_count, event_address,
      status, created_at,
      member:members(display_name, photo_url)
    `)
    .eq("creator_id", creator.id)
    .in("status", ["open", "quoted"])
    .order("event_date", { ascending: true });

  const allRows = (inquiries ?? []) as Array<{
    id: string;
    event_date: string;
    event_time: string | null;
    guest_count: number;
    event_address: string | null;
    status: "open" | "quoted";
    created_at: string;
    member: { display_name: string; photo_url: string | null } | null;
  }>;

  const openCount = allRows.filter((r) => r.status === "open").length;
  const quotedCount = allRows.filter((r) => r.status === "quoted").length;

  const rows =
    filter === "open"
      ? allRows.filter((r) => r.status === "open")
      : filter === "quoted"
        ? allRows.filter((r) => r.status === "quoted")
        : allRows;

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-foreground">Catering inquiries</h1>
          <p className="text-xs text-muted-foreground">
            {allRows.length === 0
              ? "No active requests."
              : `${openCount} need a quote · ${quotedCount} waiting on deposit`}
          </p>

          {/* Filter tabs — URL-driven, server-rendered. No client
              island, no JS cost. Each tab carries its own count. */}
          <nav
            className="glass-segment mt-3 flex gap-1 p-1"
            aria-label="Filter inquiries"
          >
            <TabLink
              label="All"
              count={allRows.length}
              active={filter === "all"}
              href="/catering/inquiries"
            />
            <TabLink
              label="Open"
              count={openCount}
              active={filter === "open"}
              href="/catering/inquiries?status=open"
              tone="amber"
            />
            <TabLink
              label="Quoted"
              count={quotedCount}
              active={filter === "quoted"}
              href="/catering/inquiries?status=quoted"
              tone="blue"
            />
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 pt-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <Inbox size={28} className="text-muted-foreground/60" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {filter === "quoted"
                ? "No quotes waiting on a deposit right now."
                : filter === "open"
                  ? "No new inquiries waiting on a quote."
                  : "Catering requests from customers will show up here."}
            </p>
            {filter === "all" && (
              <p className="text-center text-xs text-muted-foreground/60">
                Make sure you&apos;ve published at least one catering listing.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((inq) => {
              const eventDateLabel = new Date(
                inq.event_date + "T00:00:00"
              ).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const timeLabel = inq.event_time
                ? new Date(
                    `2000-01-01T${inq.event_time}`
                  ).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : null;
              return (
                <li key={inq.id}>
                  <Link
                    href={`/catering/inquiries/${inq.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 transition-all hover:border-border/60 active:scale-[0.99]"
                  >
                    {/* Status indicator */}
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase ${
                        inq.status === "open"
                          ? "bg-amber-500/10 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-blue-500/10 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                      aria-label={`Status: ${inq.status}`}
                    >
                      {inq.status === "open" ? "NEW" : "Q'D"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {inq.member?.display_name ?? "Customer"}
                        </p>
                        <p className="shrink-0 text-[11px] text-muted-foreground">
                          {eventDateLabel}
                          {timeLabel ? ` · ${timeLabel}` : ""}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {inq.guest_count}
                        </span>
                        {inq.event_address && (
                          <span className="flex items-center gap-1 truncate">
                            <Calendar size={11} />
                            {inq.event_address.slice(0, 40)}
                            {inq.event_address.length > 40 && "…"}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabLink({
  label,
  count,
  active,
  href,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  tone?: "amber" | "blue";
}) {
  const countTone = active
    ? "text-foreground/80"
    : tone === "amber"
      ? "text-amber-700/80 dark:text-amber-300/80"
      : tone === "blue"
        ? "text-blue-700/80 dark:text-blue-300/80"
        : "text-muted-foreground";
  return (
    <Link
      href={href}
      // Anchor tags inside the glass-segment behave the same as
      // buttons would — we just lose the search-param state on a
      // full reload, which is fine.
      className={`glass-segment-item flex-1 py-2 text-center text-xs font-medium transition-all ${
        active
          ? "glass-segment-item-active text-foreground"
          : "text-muted-foreground hover:text-foreground/80"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1 text-[10px] ${countTone}`}>{count}</span>
      )}
    </Link>
  );
}
