import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/** Deposit percentage. Hard-coded to 30 per the product spec; could be
 *  promoted to a per-creator config later. */
const DEPOSIT_PERCENT = 30;

/**
 * POST /api/v1/catering/quotes
 *
 * Creator sends a quote in response to a catering inquiry. Validates
 * the inquiry belongs to the creator, computes deposit + balance,
 * inserts the quote row, flips the inquiry to `quoted`, fires the
 * dual quote-sent email + SMS (creator + customer).
 *
 * Body shape (sanitized):
 *   {
 *     inquiry_id: uuid,
 *     line_items: [{ name, qty, unit_price_cents, listing_id? }, ...],
 *     fees_cents?: number,
 *     tax_cents?: number,
 *     creator_notes?: string,
 *     expires_days?: number (default 7, clamp 1..30)
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const inquiryId = body.inquiry_id;
    if (typeof inquiryId !== "string" || !inquiryId) {
      return apiError("Missing inquiry_id.", 400);
    }

    const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
    if (rawItems.length === 0) {
      return apiError("Quote needs at least one line item.", 400);
    }

    // Sanitize line items. Anything malformed is dropped silently so a
    // typo on the client doesn't break the whole POST.
    const lineItems = rawItems
      .map((raw: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = (raw ?? {}) as any;
        const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
        const qty = Math.max(1, Math.min(9999, Math.floor(Number(r.qty) || 0)));
        const unit = Math.max(0, Math.floor(Number(r.unit_price_cents) || 0));
        if (!name || qty <= 0) return null;
        return {
          name,
          qty,
          unit_price_cents: unit,
          total_cents: qty * unit,
          listing_id:
            typeof r.listing_id === "string" && r.listing_id ? r.listing_id : null,
        };
      })
      .filter(Boolean);

    if (lineItems.length === 0) {
      return apiError("All line items were invalid.", 400);
    }

    const feesCents = Math.max(0, Math.floor(Number(body.fees_cents) || 0));
    const taxCents = Math.max(0, Math.floor(Number(body.tax_cents) || 0));
    const creatorNotes =
      typeof body.creator_notes === "string"
        ? body.creator_notes.trim().slice(0, 2000) || null
        : null;
    const expiresDays = Math.max(
      1,
      Math.min(30, Math.floor(Number(body.expires_days) || 7))
    );

    // Money. Deposit is 30% of the FOOD subtotal (no fees, no tax) —
    // user-visible promise on the storefront.
    const foodSubtotalCents = lineItems.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (acc: number, it: any) => acc + it.total_cents,
      0
    );
    const totalCents = foodSubtotalCents + feesCents + taxCents;
    const depositCents = Math.round(foodSubtotalCents * (DEPOSIT_PERCENT / 100));
    const balanceCents = totalCents - depositCents;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // Resolve the creator row + verify the inquiry belongs to them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creator } = await (supabase as any)
      .from("creators")
      .select("id")
      .eq("member_id", user.id)
      .single();
    if (!creator) return apiError("Creator profile not found.", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inquiry } = await (supabase as any)
      .from("catering_inquiries")
      .select("id, creator_id, member_id, status")
      .eq("id", inquiryId)
      .single();
    if (!inquiry) return apiError("Inquiry not found.", 404);
    if (inquiry.creator_id !== creator.id) {
      return apiError("Inquiry doesn't belong to you.", 403);
    }
    if (inquiry.status !== "open" && inquiry.status !== "quoted") {
      return apiError(
        `Can't quote an inquiry in '${inquiry.status}' state.`,
        409
      );
    }

    // Supersede any previously-sent quote for this inquiry so we don't
    // have two 'sent' quotes floating around (customer would see two
    // pay buttons).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("catering_quotes")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("inquiry_id", inquiryId)
      .eq("status", "sent");

    const expiresAt = new Date(
      Date.now() + expiresDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote, error: insertErr } = await (supabase as any)
      .from("catering_quotes")
      .insert({
        inquiry_id: inquiryId,
        creator_id: creator.id,
        member_id: inquiry.member_id,
        line_items: lineItems,
        food_subtotal_cents: foodSubtotalCents,
        fees_cents: feesCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        deposit_cents: depositCents,
        balance_cents: balanceCents,
        creator_notes: creatorNotes,
        expires_at: expiresAt,
        status: "sent",
      })
      .select()
      .single();

    if (insertErr || !quote) {
      console.error("[quotes.POST] insert failed:", insertErr?.message);
      return apiError("Couldn't send the quote. Try again.", 500);
    }

    // Bump the inquiry to 'quoted'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("catering_inquiries")
      .update({ status: "quoted", updated_at: new Date().toISOString() })
      .eq("id", inquiryId);

    // Fire-and-forget notifications to both parties.
    notifyQuoteSentFireAndForget(quote.id).catch((err) => {
      console.error("[quotes.POST] notify threw:", err);
    });

    return apiSuccess({ quote });
  } catch (err) {
    console.error("[quotes.POST] threw:", err);
    return apiError("Couldn't send the quote. Try again.", 500);
  }
}

/**
 * GET /api/v1/catering/quotes?inquiry_id=<uuid>
 *
 * Returns the latest (non-superseded) quote for an inquiry. Used by the
 * creator's inquiry-detail page to show the quote status inline. RLS
 * scopes to quotes the caller is a party to.
 */
export async function GET(request: NextRequest) {
  try {
    const inquiryId = request.nextUrl.searchParams.get("inquiry_id");
    if (!inquiryId) return apiError("Missing inquiry_id.", 400);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("catering_quotes")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[quotes.GET] failed:", error.message);
      return apiError("Failed to fetch quote.", 500);
    }

    return apiSuccess({ quote: data?.[0] ?? null });
  } catch {
    return apiError("Failed to fetch quote.", 500);
  }
}

async function notifyQuoteSentFireAndForget(quoteId: string) {
  const { notifyCateringQuoteSent } = await import("@/lib/notifications");
  await notifyCateringQuoteSent({ quoteId });
}
