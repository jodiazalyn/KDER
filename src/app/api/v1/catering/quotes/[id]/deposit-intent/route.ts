import { NextRequest } from "next/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/catering/quotes/:id/deposit-intent
 *
 * Creates a Stripe Checkout Session for the 30% deposit + saves the
 * card on file (via payment_intent_data.setup_future_usage='off_session')
 * so the balance auto-charge cron in PR 4 can use it without prompting
 * the customer.
 *
 * Returns `{ checkout_url }`. The customer-facing /catering/quote/[id]
 * page redirects to it.
 *
 * Bookings get created in the webhook handler (payment_intent.succeeded
 * with metadata.type='catering_deposit'), not here — that decouples
 * booking creation from the client's request lifecycle and stays race-
 * free if the user closes the tab between confirm and webhook delivery.
 *
 * Reuses the same checkout pattern as /api/v1/checkout (plate orders):
 * application_fee_amount + transfer_data routes the platform fee to
 * KDER's balance and the rest to the creator's Connect account.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Sign in to pay the deposit.", 401);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote } = await (supabase as any)
      .from("catering_quotes")
      .select(`
        id, inquiry_id, creator_id, member_id, status,
        deposit_cents, total_cents, expires_at,
        creator:creators(id, stripe_connect_id, kyc_status, member:members(handle, display_name)),
        inquiry:catering_inquiries(event_date)
      `)
      .eq("id", quoteId)
      .single();

    if (!quote) return apiError("Quote not found.", 404);
    if (quote.member_id !== user.id) {
      return apiError("Only the customer can pay this quote.", 403);
    }
    if (quote.status !== "sent") {
      return apiError(`This quote is ${quote.status}.`, 409);
    }
    if (new Date(quote.expires_at) < new Date()) {
      return apiError("This quote has expired. Ask the creator to resend.", 410);
    }
    if (
      !quote.creator?.stripe_connect_id ||
      quote.creator?.kyc_status !== "verified"
    ) {
      return apiError(
        "The creator isn't set up to receive payments yet.",
        503
      );
    }

    // Pull the member's email (Stripe customer creation + Checkout
    // form pre-fill). We use the email saved on members.email when
    // available (set during catering inquiry + plate checkout flows).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (supabase as any)
      .from("members")
      .select("id, stripe_customer_id, email, display_name")
      .eq("id", user.id)
      .single();
    if (!member) return apiError("Member profile missing.", 404);

    // Reuse the member's Stripe customer if they have one (regular
    // plate checkout creates them too).
    let stripeCustomerId = member.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const cust = await stripe.customers.create({
        email: member.email ?? undefined,
        name: member.display_name ?? undefined,
        metadata: { member_id: member.id },
      });
      stripeCustomerId = cust.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("members")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", member.id);
    }

    const platformFeeCents = Math.round(
      quote.deposit_cents * (PLATFORM_FEE_PERCENT / 100)
    );

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const creatorName = quote.creator?.member?.display_name ?? "your creator";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Catering deposit — ${creatorName}`,
              description: `30% deposit for your ${new Date(
                quote.inquiry.event_date + "T00:00:00"
              ).toLocaleDateString("en-US", { month: "long", day: "numeric" })} event`,
            },
            unit_amount: quote.deposit_cents,
          },
          quantity: 1,
        },
      ],
      // CRITICAL: this is what saves the card for the off-session
      // balance charge later. Without it the balance-charge cron in
      // PR 4 has no payment method to use.
      payment_intent_data: {
        setup_future_usage: "off_session",
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: quote.creator.stripe_connect_id },
        metadata: {
          type: "catering_deposit",
          quote_id: quote.id,
          inquiry_id: quote.inquiry_id,
          creator_id: quote.creator_id,
          member_id: quote.member_id,
        },
      },
      success_url: `${origin}/catering/quote/${quote.id}?paid=1`,
      cancel_url: `${origin}/catering/quote/${quote.id}`,
      // Pre-fill if we have it; suppress the customer-email field
      // entirely if not — they'll add it during Checkout.
      ...(member.email ? {} : { customer_email: undefined }),
    });

    if (!session.url) {
      return apiError("Stripe didn't return a checkout URL.", 500);
    }

    return apiSuccess({
      checkout_url: session.url,
      amount_cents: quote.deposit_cents,
      payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    });
  } catch (err) {
    console.error("[deposit-intent] threw:", err);
    return apiError("Couldn't start the deposit. Try again.", 500);
  }
}
