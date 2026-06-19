import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, Users, AlertCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string;
  event_date: string;
  event_time: string | null;
  status:
    | "pending_acceptance"
    | "confirmed"
    | "balance_due"
    | "balance_paid"
    | "completed"
    | "cancelled";
  total_cents: number;
  balance_cents: number;
  balance_charged_at: string | null;
  balance_charge_scheduled_for: string | null;
  inquiry: { guest_count: number; event_address: string | null } | null;
  customer: { display_name: string; photo_url: string | null } | null;
}

/**
 * Creator's catering bookings list. Three buckets:
 *   - Upcoming  → confirmed + balance_paid, event_date >= today
 *   - Past      → completed, event_date < today
 *   - Issues    → balance_due (charge failed, needs attention)
 *
 * Cancelled / pending_acceptance bookings render in their own
 * surfaces (cancelled is terminal, pending lives on the inquiry
 * detail page) so this list stays focused on actionable work.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "past" || tab === "issues" ? tab : "upcoming";

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select("id")
    .eq("member_id", user.id)
    .single();
  if (!creator) redirect("/onboarding/creator");

  const today = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("catering_bookings")
    .select(`
      id, event_date, event_time, status, total_cents, balance_cents,
      balance_charged_at, balance_charge_scheduled_for,
      inquiry:catering_inquiries(guest_count, event_address),
      customer:members!catering_bookings_member_id_fkey(display_name, photo_url)
    `)
    .eq("creator_id", creator.id);

  if (activeTab === "upcoming") {
    query = query
      .in("status", ["confirmed", "balance_paid"])
      .gte("event_date", today)
      .order("event_date", { ascending: true });
  } else if (activeTab === "past") {
    query = query
      .in("status", ["completed"])
      .order("event_date", { ascending: false });
  } else {
    // issues
    query = query.eq("status", "balance_due").order("event_date", { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    console.error("[bookings] query failed:", error.message);
  }
  const rows = (data ?? []) as BookingRow[];

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-foreground">Catering bookings</h1>
          <p className="text-xs text-muted-foreground">
            Confirmed + paid catering events
          </p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-lg">
          {(
            [
              { key: "upcoming", label: "Upcoming" },
              { key: "issues", label: "Issues" },
              { key: "past", label: "Past" },
            ] as const
          ).map((t) => (
            <Link
              key={t.key}
              href={`/catering/bookings?tab=${t.key}`}
              className={`flex h-12 flex-1 items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                activeTab === t.key
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 pt-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <CalendarRange size={28} className="text-muted-foreground/60" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {activeTab === "upcoming"
                ? "No upcoming bookings."
                : activeTab === "issues"
                  ? "No bookings need attention."
                  : "No past bookings yet."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((b) => {
              const eventDateLabel = new Date(
                b.event_date + "T00:00:00"
              ).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const timeLabel = b.event_time
                ? new Date(`2000-01-01T${b.event_time}`).toLocaleTimeString(
                    "en-US",
                    { hour: "numeric", minute: "2-digit" }
                  )
                : null;
              const isIssue = b.status === "balance_due";
              return (
                <li key={b.id}>
                  <Link
                    href={`/catering/bookings/${b.id}`}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition-all active:scale-[0.99] ${
                      isIssue
                        ? "border-red-400/[0.30] bg-red-500/10 hover:border-red-400/[0.45] dark:bg-red-900/[0.20]"
                        : "border-border bg-muted/30 hover:border-border/60"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isIssue
                          ? "bg-red-500/10 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : b.status === "completed"
                            ? "bg-muted/40 text-muted-foreground"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {isIssue ? (
                        <AlertCircle size={18} />
                      ) : b.status === "completed" ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <CalendarRange size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {b.customer?.display_name ?? "Customer"}
                        </p>
                        <p className="shrink-0 text-[11px] text-muted-foreground">
                          {eventDateLabel}
                          {timeLabel ? ` · ${timeLabel}` : ""}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {b.inquiry?.guest_count ?? 0}
                        </span>
                        <span className="text-foreground/80">
                          ${(b.total_cents / 100).toFixed(0)}
                        </span>
                        <StatusBadge status={b.status} />
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

function StatusBadge({ status }: { status: BookingRow["status"] }) {
  const map: Record<BookingRow["status"], { label: string; cls: string }> = {
    pending_acceptance: { label: "Pending", cls: "text-amber-700 dark:text-orange-300" },
    confirmed: { label: "Confirmed", cls: "text-primary" },
    balance_due: { label: "Balance due", cls: "text-red-600 dark:text-red-400" },
    balance_paid: { label: "Paid in full", cls: "text-primary" },
    completed: { label: "Complete", cls: "text-muted-foreground" },
    cancelled: { label: "Cancelled", cls: "text-muted-foreground/60" },
  };
  const m = map[status];
  return (
    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}
