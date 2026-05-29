import { NextRequest, NextResponse } from "next/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { apiError } from "@/lib/api";

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

    if (!items || items.length === 0) {
      return apiError("Cart is empty", 400);
    }

    if (!member_name || !member_phone) {
      return apiError("Name and phone are required", 400);
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

    // Calculate subtotal for platform fee. Includes plate × qty +
    // every verified extra (price_cents × qty per extra).
    const subtotalCents = verifiedItems.reduce((sum, item) => {
      const plateCents =
        Math.round(item.price * 100) * item.quantity;
      const extrasCents = item.extras.reduce(
        (acc, e) => acc + e.price_cents * e.qty,
        0
      );
      return sum + plateCents + extrasCents;
    }, 0);
    const platformFeeCents = Math.round(
      subtotalCents * (PLATFORM_FEE_PERCENT / 100)
    );

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

    const totalAmount = subtotalCents / 100;
    const platformFee = platformFeeCents / 100;
    const creatorPayout = totalAmount - platformFee;

    // Let Postgres generate the UUID via DEFAULT gen_random_uuid()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedOrder, error: orderErr } = await (supabase as any)
      .from("orders")
      .insert({
        creator_id: creatorRow.id,
        creator_handle,
        member_id: user.id,
        member_name: member_name.trim(),
        member_phone: member_phone.trim(),
        fulfillment_type,
        delivery_address: delivery_address?.trim() || null,
        customer_email: customerEmail,
        notes: sanitizedNotes || null,
        quantity: verifiedItems.reduce((s, i) => s + i.quantity, 0),
        total_amount: totalAmount,
        platform_fee: platformFee,
        creator_payout: creatorPayout,
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
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
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: creatorRow.stripe_connect_id,
        },
      },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    return apiError("Failed to create checkout session", 500);
  }
}
