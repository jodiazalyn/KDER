import { NextRequest, NextResponse } from "next/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { apiError } from "@/lib/api";
import { applyDiscount } from "@/lib/discount-codes";
import type { DiscountCode } from "@/types";

interface CheckoutItemExtra {
  name: string;
  price_cents: number;
  qty: number;
}

interface CheckoutItem {
  listing_id: string;
  name: string;
  price: number;
  quantity: number;
  photo: string | null;
  /** Customer-picked add-ons (migration 018). Server re-verifies
   *  each against the listing's current extras and rewrites
   *  price_cents from the server-side value, so client tampering
   *  can't inflate the order. */
  extras?: CheckoutItemExtra[];
}

interface CheckoutBody {
  items: CheckoutItem[];
  member_name: string;
  member_phone: string;
  fulfillment_type: string;
  notes: string;
  creator_handle: string;
  delivery_address?: string;
  customer_email?: string;
  /** Structured dropoff for Uber Direct (Phase 2 — migration 019).
   *  Optional / NULL for pickup orders. */
  dropoff?: {
    street_address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  } | null;
  /** Uber Direct quote_id the customer accepted at the storefront.
   *  Reused at delivery-creation time in the post-payment webhook
   *  so the fee we book matches the fee we charged. */
  uber_quote_id?: string | null;
  /** Cents — what Uber quoted. Server re-validates the quote
   *  server-side if we're being cautious, but for v1 we trust
   *  the client value (Uber will re-quote at create-delivery
   *  time anyway; the difference is small enough to absorb if
   *  it doesn't match). */
  uber_fee_cents?: number | null;
  /** Customer-entered promo code (migration 024). Validated + applied
   *  server-side against the creator's own code list — a client-
   *  supplied discount amount is never trusted. */
  discount_code?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutBody = await request.json();
    const {
      items,
      member_name,
      member_phone,
      fulfillment_type,
      notes,
      creator_handle,
      delivery_address,
    } = body;

    const customerEmail =
      typeof body.customer_email === "string" && body.customer_email.trim()
        ? body.customer_email.trim().toLowerCase().slice(0, 254)
        : null;

    // ── Uber Direct delivery fields (Phase 2, migration 019) ─────
    // We only honor these when fulfillment_type is "delivery" — for
    // pickup orders any client-supplied uber_* gets dropped to null
    // so a tampered client can't sneak a fee onto a pickup order.
    const isDelivery = fulfillment_type === "delivery";
    const uberQuoteId =
      isDelivery && typeof body.uber_quote_id === "string"
        ? body.uber_quote_id.slice(0, 80)
        : null;
    const uberFeeCents =
      isDelivery && typeof body.uber_fee_cents === "number" &&
      body.uber_fee_cents >= 0 && body.uber_fee_cents < 100_00
        ? Math.floor(body.uber_fee_cents)
        : 0;
    const dropoffStreet =
      isDelivery && typeof body.dropoff?.street_address === "string"
        ? body.dropoff.street_address.trim().slice(0, 200)
        : null;
    const dropoffCity =
      isDelivery && typeof body.dropoff?.city === "string"
        ? body.dropoff.city.trim().slice(0, 80)
        : null;
    const dropoffState =
      isDelivery && typeof body.dropoff?.state === "string"
        ? body.dropoff.state.trim().toUpperCase().slice(0, 2)
        : null;
    const dropoffZip =
      isDelivery && typeof body.dropoff?.zip_code === "string"
        ? body.dropoff.zip_code.trim().slice(0, 10)
        : null;

    // Delivery orders without a quote or structured dropoff can't
    // be fulfilled — block the order at checkout rather than
    // letting it succeed and silently fail at delivery booking.
    if (isDelivery && (!uberQuoteId || !uberFeeCents || !dropoffZip)) {
      return apiError(
        "Delivery details are incomplete. Pick a dropoff address and wait for the quote, or switch to pickup.",
        400
      );
    }

    if (!items || items.length === 0) {
      return apiError("Cart is empty", 400);
    }

    // Contact requirements split by fulfillment:
    //   - delivery → name + phone REQUIRED (Uber's courier needs
    //     a number to reach the customer at the door)
    //   - pickup   → name + (phone OR email) — one notification
    //     channel is enough so we don't gate the order on a
    //     number the customer doesn't want to share
    if (!member_name) {
      return apiError("Name is required.", 400);
    }
    if (isDelivery && !member_phone) {
      return apiError(
        "Phone is required for delivery — the courier needs to reach you at the door.",
        400
      );
    }
    if (!isDelivery && !member_phone && !customerEmail) {
      return apiError(
        "Enter a phone number or email so we can send order updates.",
        400
      );
    }

    // Require authenticated customer. The client-side gate should have
    // redirected to /signup?mode=customer before reaching here, but enforce
    // server-side so API callers can't create anonymous orders.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Sign in to place an order.", 401);
    }

    const listingIds = items.map((i) => i.listing_id);
    // Pull `extras` too so we can verify customer-supplied add-on
    // prices server-side instead of trusting whatever the client
    // posts. Migration 018.
    type ListingRow = {
      id: string;
      price: number;
      name: string;
      status: string;
      extras: Array<{ name: string; price_cents: number }> | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listings } = await (supabase as any)
      .from("listings")
      .select("id, price, name, status, extras")
      .in("id", listingIds) as { data: ListingRow[] | null };

    if (!listings || listings.length !== items.length) {
      return apiError("One or more items are no longer available", 400);
    }

    const priceMap = new Map<
      string,
      { price: number; name: string; status: string; extras: Map<string, number> }
    >(
      listings.map((l) => [
        l.id,
        {
          price: l.price,
          name: l.name,
          status: l.status,
          extras: new Map(
            (l.extras ?? []).map((e) => [e.name, Math.max(0, Math.floor(e.price_cents))])
          ),
        },
      ])
    );

    for (const item of items) {
      const listing = priceMap.get(item.listing_id);
      if (!listing) {
        return apiError(`Item "${item.name}" is no longer available`, 400);
      }
      if (listing.status !== "active") {
        return apiError(`"${listing.name}" is no longer available`, 400);
      }
    }

    // Use server-side prices, not client-supplied. Same for extras:
    // we look each up by name against the listing's current `extras`
    // and use the server-side price_cents. Unknown extra names are
    // silently dropped — that protects creators from a tampered
    // client trying to inject $0 add-ons or unknown SKUs.
    const verifiedItems = items.map((item) => {
      const listing = priceMap.get(item.listing_id)!;
      const rawExtras = Array.isArray(item.extras) ? item.extras : [];
      const verifiedExtras: Array<{
        name: string;
        price_cents: number;
        qty: number;
      }> = [];
      for (const e of rawExtras) {
        if (!e || typeof e !== "object") continue;
        const name = typeof e.name === "string" ? e.name : "";
        const qty = Math.max(0, Math.min(99, Math.floor(Number(e.qty) || 0)));
        if (!name || qty <= 0) continue;
        const serverPrice = listing.extras.get(name);
        if (serverPrice === undefined) continue; // unknown extra
        verifiedExtras.push({ name, price_cents: serverPrice, qty });
      }
      return {
        ...item,
        price: listing.price,
        name: listing.name,
        quantity: Math.min(Math.max(1, Math.round(item.quantity)), 99),
        extras: verifiedExtras,
      };
    });

    // Build line items for Stripe using verified prices. Each extra
    // gets its own Stripe line so the customer's Stripe receipt
    // reads "Plate × 2" + "Lemonade × 4" + "Cookie × 2" rather than
    // a single rolled-up sum.
    const line_items = verifiedItems.flatMap((item) => {
      const base = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.name,
              ...(item.photo ? { images: [item.photo] } : {}),
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        },
      ];
      const extraLines = item.extras.map((e) => ({
        price_data: {
          currency: "usd",
          product_data: { name: `${item.name} · ${e.name}` },
          unit_amount: e.price_cents,
        },
        quantity: e.qty,
      }));
      return [...base, ...extraLines];
    });

    // Add delivery fee as its own Stripe line so the customer's
    // receipt reads "Uber Direct delivery $X" clearly. Skipped on
    // pickup orders (uberFeeCents stays 0 there).
    if (isDelivery && uberFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery (Uber Direct)" },
          unit_amount: uberFeeCents,
        },
        quantity: 1,
      });
    }

    // Calculate subtotal for platform fee. Includes plate × qty +
    // every verified extra (price_cents × qty per extra). Delivery
    // fee is NOT in the platform-fee base — KDER's 10% only
    // applies to the food, not to the pass-through Uber cost.
    const subtotalCents = verifiedItems.reduce((sum, item) => {
      const plateCents =
        Math.round(item.price * 100) * item.quantity;
      const extrasCents = item.extras.reduce(
        (acc, e) => acc + e.price_cents * e.qty,
        0
      );
      return sum + plateCents + extrasCents;
    }, 0);
    // ── Promo code (migration 024) ──────────────────────────────
    // Apply the customer-entered code against THIS creator's own code
    // list, computed server-side so a tampered client can't inflate
    // the discount. We look up the codes up-front (cheap, indexed by
    // handle) and validate against the *pre-discount* food subtotal.
    let discountCents = 0;
    let appliedCode: string | null = null;
    if (typeof body.discount_code === "string" && body.discount_code.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codeRow } = await (supabase as any)
        .from("creators")
        .select("discount_codes, members!inner(handle)")
        .eq("members.handle", creator_handle)
        .single() as {
          data: { discount_codes: DiscountCode[] | null } | null;
        };
      const result = applyDiscount(
        body.discount_code,
        codeRow?.discount_codes ?? [],
        subtotalCents
      );
      if (!result.ok) {
        // Surface a specific, customer-actionable reason. We block the
        // order rather than silently ignoring an invalid code so the
        // customer isn't charged full price expecting a discount.
        if (result.reason === "expired") {
          return apiError("That promo code has expired.", 400);
        }
        if (result.reason === "min_order") {
          const min = ((result.minOrderCents ?? 0) / 100).toFixed(2);
          return apiError(
            `That promo code needs a minimum order of $${min}.`,
            400
          );
        }
        return apiError("That promo code isn't valid.", 400);
      }
      discountCents = result.discountCents;
      appliedCode = result.code.code;
    }

    // Food subtotal AFTER the promo discount. The platform fee, grand
    // total, and creator payout all derive from this — see the
    // "proportional" fee model in migration 024.
    const discountedSubtotalCents = subtotalCents - discountCents;
    const platformFeeCents = Math.round(
      discountedSubtotalCents * (PLATFORM_FEE_PERCENT / 100)
    );
    // The Stripe `application_fee_amount` routes ALL of KDER's
    // share to our platform account:
    //   - platform_fee_cents = 10% of food (existing KDER revenue)
    //   - uber_fee_cents = pass-through to KDER, who pays Uber's
    //     invoice on the back end
    // Net to the creator's Connect account = grand total minus
    // this combined application fee, which equals the food
    // subtotal minus 10%. Pickup orders have uber_fee_cents=0
    // so the math is unchanged for them.
    const applicationFeeCents = platformFeeCents + uberFeeCents;

    // Build origin URL for redirects
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // Sanitize notes
    const sanitizedNotes = (notes || "").trim().replace(/<[^>]*>/g, "");

    // Resolve creator by handle — orders.creator_id is NOT NULL.
    // Also pull stripe_connect_id + kyc_status so we can (a) route the
    // payment split to the right connected account and (b) defensively
    // block checkout if somehow the creator isn't Connect-verified.
    // (Phase B gates plate activation on kyc_status = 'verified', so this
    // branch should never fire in practice — belt-and-suspenders.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creatorRow } = await (supabase as any)
      .from("creators")
      .select("id, stripe_connect_id, kyc_status, members!inner(handle)")
      .eq("members.handle", creator_handle)
      .single() as {
        data: {
          id: string;
          stripe_connect_id: string | null;
          kyc_status: string | null;
        } | null;
      };

    if (!creatorRow) {
      return apiError("Creator not found", 404);
    }

    if (
      !creatorRow.stripe_connect_id ||
      creatorRow.kyc_status !== "verified"
    ) {
      return apiError(
        "This creator isn't set up to receive payments yet.",
        503
      );
    }

    // Grand total = discounted food + delivery (delivery is 0 on
    // pickup). Any promo code (migration 024) already reduced
    // discountedSubtotalCents, and the platform fee was recomputed on
    // that reduced base, so the split stays proportional.
    const grandTotalCents = discountedSubtotalCents + uberFeeCents;
    const totalAmount = grandTotalCents / 100;
    const platformFee = platformFeeCents / 100;
    // Creator nets discounted food minus the platform fee. The
    // delivery slice never touches their payout.
    const creatorPayout = (discountedSubtotalCents - platformFeeCents) / 100;

    // Let Postgres generate the UUID via DEFAULT gen_random_uuid()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedOrder, error: orderErr } = await (supabase as any)
      .from("orders")
      .insert({
        creator_id: creatorRow.id,
        creator_handle,
        member_id: user.id,
        member_name: member_name.trim(),
        // Trim and coerce empty → null so an email-only pickup
        // order doesn't carry around a stray "" we'd later have
        // to special-case downstream (SMS sender, order pages).
        member_phone: member_phone?.trim() || null,
        fulfillment_type,
        delivery_address:
          dropoffStreet ||
          delivery_address?.trim() ||
          null,
        // Uber Direct order context (migration 019). Persisted at
        // checkout time so the post-payment webhook has everything
        // it needs to create the delivery without re-touching the
        // request payload.
        uber_quote_id: uberQuoteId,
        uber_fee_cents: uberFeeCents || null,
        dropoff_address: dropoffStreet,
        dropoff_instructions:
          isDelivery && dropoffCity && dropoffState && dropoffZip
            ? JSON.stringify({
                city: dropoffCity,
                state: dropoffState,
                zip_code: dropoffZip,
              })
            : null,
        customer_email: customerEmail,
        notes: sanitizedNotes || null,
        quantity: verifiedItems.reduce((s, i) => s + i.quantity, 0),
        total_amount: totalAmount,
        platform_fee: platformFee,
        creator_payout: creatorPayout,
        // Promo code snapshot (migration 024). Null / 0 when no code was
        // applied. total_amount + creator_payout already reflect the cut.
        discount_code: appliedCode,
        discount_cents: discountCents,
        status: "pending",
        items: verifiedItems.map((i) => ({
          listing_id: i.listing_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          // Snapshot the photo at checkout time so the order page can show
          // the correct plate image even if the listing is later edited or
          // removed. Was previously omitted, which made every order page
          // render a "No photo" placeholder for multi-item orders (where the
          // listings JOIN can't pick a single image).
          photo: i.photo ?? null,
          // Selected add-ons (migration 018). Omitted on legacy
          // orders; render path treats missing/empty as no extras.
          extras: i.extras.length > 0 ? i.extras : undefined,
        })),
      })
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (orderErr || !insertedOrder) {
      console.error("Failed to create order:", orderErr?.message);
      return apiError("Failed to create order", 500);
    }

    const orderId = insertedOrder.id;

    // Attach the promo discount (migration 024) as an ephemeral,
    // one-shot Stripe coupon so the hosted checkout page + the
    // customer's receipt show the reduction explicitly ("SUMMER10
    // –$5.00") instead of silently lowering line prices. We keep our
    // pre-discount line_items and let Stripe subtract amount_off. The
    // application_fee_amount was already recomputed on the discounted
    // subtotal, so it stays <= the post-discount charge total.
    const discounts: Array<{ coupon: string }> = [];
    if (discountCents > 0 && appliedCode) {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "usd",
        duration: "once",
        name: appliedCode,
      });
      discounts.push({ coupon: coupon.id });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      ...(discounts.length ? { discounts } : {}),
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        order_id: orderId,
        creator_handle,
        member_name: member_name.trim(),
        member_phone: member_phone.trim(),
        fulfillment_type,
        notes: sanitizedNotes,
        platform_fee_cents: String(platformFeeCents),
        item_ids: verifiedItems.map((i) => i.listing_id).join(","),
        // Promo code context (migration 024). Empty when no code.
        discount_code: appliedCode ?? "",
        discount_cents: discountCents ? String(discountCents) : "",
        // Uber Direct context (Phase 2). Makes Stripe events
        // self-describing — any payment in the Stripe Dashboard
        // can be cross-referenced against its Uber booking
        // without joining tables. Empty strings on pickup
        // orders.
        uber_quote_id: uberQuoteId ?? "",
        uber_fee_cents: uberFeeCents ? String(uberFeeCents) : "",
      },
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}&handle=${encodeURIComponent(creator_handle)}&order_id=${orderId}`,
      cancel_url: `${origin}/@${creator_handle}`,
      // Stripe splits the payment at charge time:
      //  - application_fee_amount cents go to KDER's platform balance
      //  - the rest (minus Stripe's processing fee) lands on the creator's
      //    connected account
      // Stripe then pays out KDER's platform balance to our bank on the
      // default schedule (2-day rolling ACH).
      // PLATFORM_FEE_PERCENT defaults to 10 (set via STRIPE_PLATFORM_FEE_PERCENT env var).
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: creatorRow.stripe_connect_id,
        },
      },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    // Pass the real Stripe/DB message through to the client. Stripe's
    // errors here are operator-facing and safe to show (e.g. "No such
    // destination", "account ... does not have the transfers
    // capability enabled", test/live key mismatch) — they're what an
    // operator needs to fix the misconfiguration. Falls back to the
    // generic copy if the throw carries no message.
    const detail =
      error instanceof Error && error.message
        ? error.message
        : "Failed to create checkout session";
    return apiError(detail, 500);
  }
}
