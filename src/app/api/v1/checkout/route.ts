import { NextRequest, NextResponse } from "next/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { apiError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

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

    // ── Fix 5: Verify prices server-side ────────────────────────
    let verifiedItems = items;

    if (isDemoMode()) {
      // In demo mode, verify against listings-store
      // Client prices are trusted in demo since there's no DB
      // but we still sanitize quantities
      verifiedItems = items.map((item) => ({
        ...item,
        quantity: Math.min(Math.max(1, Math.round(item.quantity)), 99),
        price: Math.max(0.01, Number(item.price)),
      }));
    } else {
      // In production, look up real prices from Supabase
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

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

      // Verify each item
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
      verifiedItems = items.map((item) => {
        const listing = priceMap.get(item.listing_id)!;
        return {
          ...item,
          price: listing.price,
          name: listing.name,
          quantity: Math.min(Math.max(1, Math.round(item.quantity)), 99),
        };
      });
    }

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

    // Generate order ID for webhook correlation
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Sanitize notes
    const sanitizedNotes = (notes || "").trim().replace(/<[^>]*>/g, "");

    // ── Fix 8: Create order record BEFORE Stripe session ────────
    if (!isDemoMode()) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const totalAmount = subtotalCents / 100;
      const platformFee = platformFeeCents / 100;
      const creatorPayout = totalAmount - platformFee;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("orders").insert({
        id: orderId,
        creator_handle,
        member_name: member_name.trim(),
        member_phone: member_phone.trim(),
        fulfillment_type,
        delivery_address: delivery_address?.trim() || null,
        notes: sanitizedNotes || null,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

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
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/@${creator_handle}`,
      // When Stripe Connect is active, uncomment:
      // payment_intent_data: {
      //   application_fee_amount: platformFeeCents,
      //   transfer_data: { destination: creatorStripeAccountId },
      // },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    return apiError("Failed to create checkout session", 500);
  }
}
