import { redirect } from "next/navigation";
import { EarningsView } from "@/components/earnings/EarningsView";
import { loadEarningsData } from "@/lib/earnings-server";
import type { EarningsData } from "@/lib/earnings-types";

// Money was previously `force-dynamic` — every tab-switch into
// Earnings re-ran auth + creator lookup + 3 Stripe calls (balance,
// payouts, account) + 2 DB queries. ~500ms-1.2s of waterfall per
// visit. Now we cache the rendered output for 60s; the page
// revalidates on the first request after the window expires.
// Trade-off: balance and payout list can be up to 60s stale.
// Acceptable — Stripe updates these on its own clock anyway, and
// the in-app "Withdraw" action does a fresh fetch when it lands.
export const revalidate = 60;

export default async function EarningsPage() {
  // Catch only auth/creator-resolution + dev-config errors. Anything else
  // is a real failure that should bubble.
  let data: EarningsData;
  try {
    data = await loadEarningsData();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "not_authenticated") {
        redirect("/login?next=/earnings");
      }
      if (err.message === "creator_not_found") {
        redirect("/onboarding");
      }
      if (err.message === "env_not_configured") {
        return <EnvNotConfiguredState />;
      }
    }
    throw err;
  }
  return <EarningsView initial={data} />;
}

function EnvNotConfiguredState() {
  return (
    <main className="px-4 pb-4 pt-6">
      <h1 className="text-3xl font-black text-white">Earnings</h1>
      <div className="glass-card rounded-glass-lg mt-4 border-orange-400/30 bg-orange-500/15 p-4 text-sm text-orange-200">
        <p className="font-medium">Earnings unavailable in this environment.</p>
        <p className="mt-1 text-xs text-white/60">
          The Earn tab requires <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
          <code>STRIPE_SECRET_KEY</code> to be set. In production these are
          configured; in dev see <code>.env.local.example</code>.
        </p>
      </div>
    </main>
  );
}
