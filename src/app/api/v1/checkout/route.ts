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
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutBody = await request.json();
    const { items, member_name, member_phone, fulfillment_type, notes, creator_handle } = body;

    if (!items || items.length === 0) {
      return apiError("Cart is empty", 400);
    }

    if (!member_name || !member_phone) {
      return apiError("Name and phone are required", 400);
    }

    // Build line items for Stripe
    const line_items = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          ...(item.photo ? { images: [item.photo] } : {}),
        },
        unit_amount: Math.round(item.price * 100), // cents
      },
      quantity: item.quantity,
    }));

    // Calculate subtotal for platform fee
    const subtotalCents = items.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0
    );
    const platformFeeCents = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100));

    // Build origin URL for redirects
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      metadata: {
        creator_handle,
        member_name,
        member_phone,
        fulfillment_type,
        notes: notes || "",
        platform_fee_cents: String(platformFeeCents),
        item_ids: items.map((i) => i.listing_id).join(","),
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
