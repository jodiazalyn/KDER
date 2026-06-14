import { requireAdmin } from "@/lib/loaders/auth";
import { loadSuperMetrics } from "@/lib/admin/metrics";
import { SuperDashboardClient } from "./super-dashboard-client";

/**
 * KDER Super Dashboard — the cofounders' internal control room.
 *
 * Access is gated by requireAdmin() (env email allowlist). The metrics
 * are computed server-side from a service-role client so the page renders
 * fully populated with no client round-trips. Marked force-dynamic so
 * every visit reflects live data — this is an internal tool, never cached.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "KDER · Super Dashboard",
  robots: { index: false, follow: false },
};

export default async function SuperDashboardPage() {
  const { service, user } = await requireAdmin();
  const metrics = await loadSuperMetrics(service);

  return <SuperDashboardClient metrics={metrics} adminEmail={user.email} />;
}
