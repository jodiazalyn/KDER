import { apiSuccess, apiError } from "@/lib/api";
import { loadEarningsData } from "@/lib/earnings-server";

/**
 * GET /api/v1/earnings — Bundled fan-out for the Earn tab.
 *
 * The page is a server component that calls `loadEarningsData()`
 * directly (faster), so this route exists primarily for the client
 * island to refetch after a mutation (instant payout, schedule
 * change, etc.) — though `router.refresh()` is preferred since it
 * re-runs the server component with fresh data without going through
 * the client at all.
 *
 * Money is returned as integer cents.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadEarningsData();
    return apiSuccess(data);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "not_authenticated") {
        return apiError("Not authenticated.", 401);
      }
      if (err.message === "creator_not_found") {
        return apiError("Creator profile not found.", 404);
      }
    }
    console.error("[/api/v1/earnings] failed:", err);
    return apiError("Failed to load earnings.", 500);
  }
}
