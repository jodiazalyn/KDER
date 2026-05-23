import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/catering/blackouts
 *
 * Two modes:
 *   - `?creator_id=<uuid>` — public read (used by the customer-side
 *     inquiry calendar to disable unavailable dates)
 *   - `?mine=true` — authenticated creator pulls their own blackouts
 *     for the dashboard calendar
 *
 * Returns both one-off dates and recurring weekday rules. The client
 * expands recurring rules into specific dates against the visible
 * month window — we don't pre-expand server-side because the rules
 * are open-ended (every Monday, forever).
 */
export async function GET(request: NextRequest) {
  try {
    const creatorIdParam = request.nextUrl.searchParams.get("creator_id");
    const mine = request.nextUrl.searchParams.get("mine") === "true";

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let creatorId: string | null = null;

    if (mine) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return apiError("Unauthorized.", 401);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: creator } = await (supabase as any)
        .from("creators")
        .select("id")
        .eq("member_id", user.id)
        .single() as { data: { id: string } | null };

      if (!creator) return apiSuccess({ blackouts: [] });
      creatorId = creator.id;
    } else if (creatorIdParam) {
      creatorId = creatorIdParam;
    } else {
      return apiError("Provide ?creator_id or ?mine=true.", 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("creator_blackouts")
      .select("id, creator_id, kind, blackout_date, weekday, reason, created_at")
      .eq("creator_id", creatorId)
      .order("blackout_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[blackouts] fetch failed:", error.message);
      return apiError("Failed to fetch blackouts.", 500);
    }

    return apiSuccess({ blackouts: data ?? [] });
  } catch {
    return apiError("Failed to fetch blackouts.", 500);
  }
}

/**
 * POST /api/v1/catering/blackouts
 * Body: { kind: 'one_off', blackout_date: 'YYYY-MM-DD', reason?: string }
 *    OR { kind: 'recurring', weekday: 0-6, reason?: string }
 *
 * The DB enforces the shape constraint — we just do a fast-fail check
 * for nicer client errors.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind;
    if (kind !== "one_off" && kind !== "recurring") {
      return apiError("kind must be 'one_off' or 'recurring'.", 400);
    }
    if (kind === "one_off") {
      if (!body.blackout_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.blackout_date)) {
        return apiError("blackout_date must be a YYYY-MM-DD string.", 400);
      }
    } else {
      const w = Number(body.weekday);
      if (!Number.isInteger(w) || w < 0 || w > 6) {
        return apiError("weekday must be 0–6 (Sun=0).", 400);
      }
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single() as { data: { id: string } | null };

    if (!creator) return apiError("Creator profile not found.", 404);

    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 200)
        : null;

    const row =
      kind === "one_off"
        ? {
            creator_id: creator.id,
            kind: "one_off" as const,
            blackout_date: body.blackout_date,
            weekday: null,
            reason,
          }
        : {
            creator_id: creator.id,
            kind: "recurring" as const,
            blackout_date: null,
            weekday: Number(body.weekday),
            reason,
          };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("creator_blackouts")
      .insert(row)
      .select()
      .single();

    if (error) {
      // Unique constraint hit — date already blacked out. Treat as
      // idempotent success.
      if (error.code === "23505") {
        return apiSuccess({ blackout: null, already_existed: true });
      }
      console.error("[blackouts] insert failed:", error.message);
      return apiError(error.message || "Failed to add blackout.", 500);
    }

    return apiSuccess({ blackout: data });
  } catch {
    return apiError("Failed to add blackout.", 500);
  }
}
