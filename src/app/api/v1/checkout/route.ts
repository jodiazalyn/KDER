import { NextRequest, NextResponse } from "next/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { apiError } from "@/lib/api";

interface CheckoutItem {
  listing_id: string;
  name: string;
  price: number;
  quantity: number;
  photo: string | null;
}

interface CheckoutBody {
  items: CheckoutItem[];
  member_name: string;
  member_phone: string;
  fulfillment_type: string;
  notes: string;
  creator_handle: string;
  delivery_address?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listings } = await (supabase as any)
      .from("listings")
      .select("id, price, name, status")
      .in("id", listingIds) as { data: Array<{ id: string; price: number; name: string; status: string }> | null };

    if (!listings || listings.length !== items.length) {
      return apiError("One or more items are no longer available", 400);
    }

    const priceMap = new Map(
      listings.map((l: { id: string; price: number; name: string; status: string }) => [l.id, { price: l.price, name: l.name, status: l.status }])
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

    // Use server-side prices, not client-supplied
    const verifiedItems = items.map((item) => {
      const listing = priceMap.get(item.listing_id)!;
      return {
        ...item,
        price: listing.price,
        name: listing.name,
        quantity: Math.min(Math.max(1, Math.round(item.quantity)), 99),
      };
    });

    // Build line items for Stripe using verified prices
    const line_items = verifiedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          ...(item.photo ? { images: [item.photo] } : {}),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Calculate subtotal for platform fee
    const subtotalCents = verifiedItems.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0
    );
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
