import Link from "next/link";
import { Inbox, Users, Calendar } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Creator's catering inquiry inbox. Shows open + quoted requests sorted
 * by event-date proximity (next event first) so the most urgent items
 * float to the top.
 *
 * PR 3 adds the quote-builder link from the detail page. PR 4 adds the
 * past/booked filter chips.
 */
export default async function CateringInquiriesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creator } = await (supabase as any)
    .from("creators")
    .select("id")
    .eq("member_id", user.id)
    .single();

  if (!creator) redirect("/onboarding/creator");

  // Open + quoted only — booked/declined live elsewhere in PR 4.
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

  const rows = (inquiries ?? []) as Array<{
    id: string;
    event_date: string;
    event_time: string | null;
    guest_count: number;
    event_address: string | null;
    status: "open" | "quoted";
    created_at: string;
    member: { display_name: string; photo_url: string | null } | null;
  }>;

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-4 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white">Catering inquiries</h1>
          <p className="text-xs text-white/50">
            {rows.length === 0
              ? "No active requests."
              : `${rows.length} active request${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 pt-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <Inbox size={28} className="text-white/30" />
            </div>
            <p className="text-center text-sm text-white/50">
              Catering requests from customers will show up here.
            </p>
            <p className="text-center text-xs text-white/30">
              Make sure you&apos;ve published at least one catering listing.
            </p>
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
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 transition-all hover:border-white/[0.18] active:scale-[0.99]"
                  >
                    {/* Status indicator */}
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase ${
                        inq.status === "open"
                          ? "bg-amber-900/40 text-amber-300"
                          : "bg-blue-900/40 text-blue-300"
                      }`}
                      aria-label={`Status: ${inq.status}`}
                    >
                      {inq.status === "open" ? "NEW" : "Q'D"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {inq.member?.display_name ?? "Customer"}
                        </p>
                        <p className="shrink-0 text-[11px] text-white/40">
                          {eventDateLabel}
                          {timeLabel ? ` · ${timeLabel}` : ""}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/50">
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
