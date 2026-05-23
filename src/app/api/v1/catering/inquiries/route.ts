import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/v1/catering/inquiries?mine=true
 *
 * Returns all inquiries where the authenticated user is either the
 * member (their submitted requests) or the creator (their inbox). The
 * RLS policy on catering_inquiries already enforces the scope —
 * `mine=true` just means "include my creator inbox", not "only my
 * member-submitted requests".
 *
 * Status filter (?status=open) narrows to one bucket for the inbox UI.
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("catering_inquiries")
      .select(`
        id, creator_id, member_id, event_date, event_time, event_end_time,
        guest_count, event_address, event_venue_type, indoor_outdoor,
        needs_server, needs_setup, earliest_setup_time, kitchen_available,
        allergies, notes, pre_selected_listing_ids, status,
        created_at, updated_at,
        member:members(id, display_name, phone, photo_url)
      `)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      console.error("[inquiries.GET] failed:", error.message);
      return apiError("Failed to fetch inquiries.", 500);
    }

    return apiSuccess({ inquiries: data ?? [] });
  } catch {
    return apiError("Failed to fetch inquiries.", 500);
  }
}

/**
 * POST /api/v1/catering/inquiries
 *
 * Customer submits a catering inquiry. Validates the date against the
 * creator's blackouts (recurring + one-off) and against the minimum
 * lead-time of the LONGEST pre-selected listing (if any items were
 * pre-selected). Bails early on past dates.
 *
 * On success: creates the row, fires `notifyCateringInquiry` to the
 * creator (email + SMS) so they see the new request immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Required fields ────────────────────────────────────
    if (!body.creator_handle && !body.creator_id) {
      return apiError("Missing creator.", 400);
    }
    if (!body.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.event_date)) {
      return apiError("event_date must be YYYY-MM-DD.", 400);
    }
    const guestCount = Number(body.guest_count);
    if (!Number.isInteger(guestCount) || guestCount <= 0) {
      return apiError("guest_count must be a positive integer.", 400);
    }

    // No past dates.
    const eventDate = new Date(body.event_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      return apiError("Event date can't be in the past.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Sign in to submit a catering inquiry.", 401);

    // ── Resolve creator from handle or id ───────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creatorQuery = (supabase as any).from("creators").select("id, members!inner(handle)");
    const { data: creator } = body.creator_id
      ? await creatorQuery.eq("id", body.creator_id).single()
      : await creatorQuery.eq("members.handle", body.creator_handle).single();

    if (!creator) return apiError("Creator not found.", 404);

    // ── Validate against creator's blackouts ────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: blackouts } = await (supabase as any)
      .from("creator_blackouts")
      .select("kind, blackout_date, weekday")
      .eq("creator_id", creator.id);

    const blocked = (blackouts ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        (b.kind === "one_off" && b.blackout_date === body.event_date) ||
        (b.kind === "recurring" && b.weekday === eventDate.getDay())
    );
    if (blocked) {
      return apiError("That date isn't available for catering.", 400);
    }

    // ── Validate against pre-selected listings' lead times ──
    const preSelected = Array.isArray(body.pre_selected_listing_ids)
      ? body.pre_selected_listing_ids.filter((s: unknown) => typeof s === "string")
      : [];

    if (preSelected.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listings } = await (supabase as any)
        .from("listings")
        .select("id, kind, creator_id, catering_lead_time_hours, catering_min_guests, catering_max_guests")
        .in("id", preSelected);

      const valid =
        Array.isArray(listings) &&
        listings.length === preSelected.length &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        listings.every((l: any) => l.kind === "catering" && l.creator_id === creator.id);

      if (!valid) {
        return apiError("One or more selected items are unavailable.", 400);
      }

      // Max lead time across all picked items wins. Reject if the event
      // is too soon.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maxLeadHours = Math.max(...listings.map((l: any) => l.catering_lead_time_hours ?? 0));
      const hoursUntilEvent =
        (eventDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilEvent < maxLeadHours) {
        return apiError(
          `These items need at least ${maxLeadHours}h lead time. Pick a date further out.`,
          400
        );
      }

      // Guest count must be within the LARGEST allowed window across the
      // picked items (every item must accept this count).
      for (const l of listings) {
        const min = l.catering_min_guests ?? 0;
        if (min > 0 && guestCount < min) {
          return apiError(
            `One of your selected items needs at least ${min} guests.`,
            400
          );
        }
        const max = l.catering_max_guests;
        if (max && guestCount > max) {
          return apiError(
            `One of your selected items only serves up to ${max} guests.`,
            400
          );
        }
      }
    }

    // ── Insert ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = {
      creator_id: creator.id,
      member_id: user.id,
      event_date: body.event_date,
      event_time: body.event_time || null,
      event_end_time: body.event_end_time || null,
      guest_count: guestCount,
      event_address:
        typeof body.event_address === "string" && body.event_address.trim()
          ? body.event_address.trim().slice(0, 500)
          : null,
      event_venue_type: ["residence", "venue", "other"].includes(body.event_venue_type)
        ? body.event_venue_type
        : null,
      indoor_outdoor: ["indoor", "outdoor", "mixed"].includes(body.indoor_outdoor)
        ? body.indoor_outdoor
        : null,
      needs_server: !!body.needs_server,
      needs_setup: !!body.needs_setup,
      earliest_setup_time: body.earliest_setup_time || null,
      kitchen_available:
        typeof body.kitchen_available === "boolean" ? body.kitchen_available : null,
      allergies:
        typeof body.allergies === "string" ? body.allergies.trim().slice(0, 1000) || null : null,
      notes:
        typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null,
      pre_selected_listing_ids: preSelected,
      status: "open" as const,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertErr } = await (supabase as any)
      .from("catering_inquiries")
      .insert(row)
      .select(`
        id, creator_id, member_id, event_date, guest_count, status, created_at
      `)
      .single();

    if (insertErr || !inserted) {
      console.error("[inquiries.POST] insert failed:", insertErr?.message);
      return apiError("Couldn't submit your request. Try again.", 500);
    }

    // Fire-and-forget notification. We don't block on email/SMS sends
    // so a slow SendGrid or Twilio doesn't slow down the API response.
    notifyCateringInquiryFireAndForget(inserted.id).catch((err) => {
      console.error("[inquiries.POST] notify threw:", err);
    });

    return apiSuccess({ inquiry: inserted });
  } catch (err) {
    console.error("[inquiries.POST] threw:", err);
    return apiError("Couldn't submit your request. Try again.", 500);
  }
}

/**
 * Best-effort notification. Imported dynamically so a hot-path
 * compile-time module pulls aren't blocking; same pattern as the
 * order-placed flow.
 */
async function notifyCateringInquiryFireAndForget(inquiryId: string) {
  const { notifyCateringInquiry } = await import("@/lib/notifications");
  await notifyCateringInquiry({ inquiryId });
}
