/**
 * Single fan-out point for order-event notifications. Routes each event
 * to the right channel(s) — email today, push (OneSignal) in a follow-up
 * PR. Keeps the route handlers slim and the notification copy in one place.
 *
 * Convention: every function is best-effort. They wrap channel calls in
 * try/catch and log on failure, never throw — order mutations must not
 * be blocked or rolled back by a failed email.
 */

import { sendEmail } from "./email";
import * as t from "./email-templates";
import type { Order } from "@/types";

interface CreatorContext {
  display_name: string;
  handle: string;
  email: string | null;
}

interface MemberContext {
  display_name: string;
  email: string | null;
}

async function safeSendEmail(
  to: string | null,
  subject: string,
  html: string,
  label: string,
  headers?: Record<string, string>
): Promise<void> {
  if (!to) {
    console.log(`[notifications] Skipped ${label} — no recipient email`);
    return;
  }
  try {
    const res = await sendEmail({ to, subject, html, headers });
    if (!res.success) {
      console.error(`[notifications] ${label} failed:`, res.error);
    }
  } catch (err) {
    console.error(`[notifications] ${label} threw:`, err);
  }
}

// Each order gets two deterministic thread IDs — one for the creator's inbox,
// one for the customer's. The first email in each thread sets Message-ID so
// subsequent emails can reference it via In-Reply-To, keeping all per-order
// updates in a single Gmail / Outlook conversation.
function orderThreadIds(orderId: string) {
  const fromDomain =
    (process.env.SENDGRID_FROM_EMAIL ?? "kder.club").split("@")[1] ?? "kder.club";
  return {
    creator: `order-${orderId}-creator@${fromDomain}`,
    customer: `order-${orderId}-customer@${fromDomain}`,
  };
}

export async function notifyOrderPlaced(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const thread = orderThreadIds(order.id);

  // First email in each thread — establish the Message-ID so all follow-up
  // emails can reference it with In-Reply-To.
  const c = t.orderPlacedCreator({ order, creator, member });
  await safeSendEmail(creator.email, c.subject, c.html, "orderPlaced→creator", {
    "Message-ID": `<${thread.creator}>`,
  });

  const m = t.orderPlacedCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderPlaced→customer", {
    "Message-ID": `<${thread.customer}>`,
  });
}

export async function notifyOrderReminder(
  order: Order,
  creator: CreatorContext,
  member: MemberContext,
  reminderNumber: 1 | 2 | 3 | 4 | 5 | 6
): Promise<void> {
  const thread = orderThreadIds(order.id);
  const c = t.orderReminderCreator({ order, creator, member, reminderNumber });
  await safeSendEmail(
    creator.email,
    c.subject,
    c.html,
    `orderReminder#${reminderNumber}→creator`,
    { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
  );
}

export async function notifyOrderAccepted(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const thread = orderThreadIds(order.id);

  const customerEmail = t.orderAcceptedCustomer({ order, creator });
  await safeSendEmail(member.email, customerEmail.subject, customerEmail.html, "orderAccepted→customer", {
    "In-Reply-To": `<${thread.customer}>`,
    References: `<${thread.customer}>`,
  });

  const creatorEmail = t.orderAcceptedCreator({ order, member });
  await safeSendEmail(creator.email, creatorEmail.subject, creatorEmail.html, "orderAccepted→creator", {
    "In-Reply-To": `<${thread.creator}>`,
    References: `<${thread.creator}>`,
  });
}

export async function notifyOrderReady(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const thread = orderThreadIds(order.id);

  const customerEmail = t.orderReadyCustomer({ order, creator });
  await safeSendEmail(member.email, customerEmail.subject, customerEmail.html, "orderReady→customer", {
    "In-Reply-To": `<${thread.customer}>`,
    References: `<${thread.customer}>`,
  });

  const creatorEmail = t.orderReadyCreator({ order, member });
  await safeSendEmail(creator.email, creatorEmail.subject, creatorEmail.html, "orderReady→creator", {
    "In-Reply-To": `<${thread.creator}>`,
    References: `<${thread.creator}>`,
  });
}

export async function notifyOrderCompleted(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const thread = orderThreadIds(order.id);

  const customerEmail = t.orderCompletedCustomer({ order, creator });
  await safeSendEmail(member.email, customerEmail.subject, customerEmail.html, "orderCompleted→customer", {
    "In-Reply-To": `<${thread.customer}>`,
    References: `<${thread.customer}>`,
  });

  const creatorEmail = t.orderCompletedCreator({ order, member });
  await safeSendEmail(creator.email, creatorEmail.subject, creatorEmail.html, "orderCompleted→creator", {
    "In-Reply-To": `<${thread.creator}>`,
    References: `<${thread.creator}>`,
  });
}

export async function notifyOrderDeclined(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const thread = orderThreadIds(order.id);

  const customerEmail = t.orderDeclinedCustomer({ order, creator });
  await safeSendEmail(member.email, customerEmail.subject, customerEmail.html, "orderDeclined→customer", {
    "In-Reply-To": `<${thread.customer}>`,
    References: `<${thread.customer}>`,
  });

  const creatorEmail = t.orderDeclinedCreator({ order, member });
  await safeSendEmail(creator.email, creatorEmail.subject, creatorEmail.html, "orderDeclined→creator", {
    "In-Reply-To": `<${thread.creator}>`,
    References: `<${thread.creator}>`,
  });
}

export async function notifyNewMessage(args: {
  recipientEmail: string | null;
  senderName: string;
  messagePreview: string;
  orderId: string | null;
  creatorHandle: string | null;
}): Promise<void> {
  const email = t.newMessageRecipient(args);
  await safeSendEmail(args.recipientEmail, email.subject, email.html, "newMessage→recipient");
}

// ── Catering ────────────────────────────────────────────────
// Each inquiry gets a deterministic Message-ID so all per-inquiry
// emails (inquiry → quote → deposit → balance → reminders) thread
// in Gmail/Outlook. Same pattern as orderThreadIds.
function cateringThreadIds(inquiryId: string) {
  const fromDomain =
    (process.env.SENDGRID_FROM_EMAIL ?? "kder.club").split("@")[1] ?? "kder.club";
  return {
    creator: `catering-${inquiryId}-creator@${fromDomain}`,
    customer: `catering-${inquiryId}-customer@${fromDomain}`,
  };
}

/**
 * Fire when a customer submits a new catering inquiry. Loads the
 * inquiry + creator + customer from the service-role DB (we don't get
 * full context from the route handler), formats an email, and also
 * sends an SMS to the creator if their phone is on file.
 *
 * Best-effort — never throws.
 */
export async function notifyCateringInquiry(args: {
  inquiryId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) {
      console.error("[notify] catering inquiry: no service client");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("catering_inquiries")
      .select(`
        id, event_date, event_time, guest_count, event_address,
        event_venue_type, indoor_outdoor, needs_server, needs_setup,
        allergies, notes,
        creator:creators(id, member:members(display_name, email, handle, phone)),
        member:members(display_name, email, phone)
      `)
      .eq("id", args.inquiryId)
      .single();

    if (!data) {
      console.error("[notify] catering inquiry not found:", args.inquiryId);
      return;
    }

    const creatorMember = data.creator?.member;
    const customer = data.member;
    if (!creatorMember || !customer) {
      console.error("[notify] catering inquiry missing join");
      return;
    }

    const thread = cateringThreadIds(data.id);
    const email = t.cateringInquiryReceivedCreator({
      inquiry: data,
      creator: {
        display_name: creatorMember.display_name ?? "Chef",
        handle: creatorMember.handle ?? "",
        email: creatorMember.email,
      },
      customer: {
        display_name: customer.display_name ?? "Customer",
        email: customer.email,
      },
    });

    await safeSendEmail(
      creatorMember.email,
      email.subject,
      email.html,
      "cateringInquiry→creator",
      { "Message-ID": `<${thread.creator}>` }
    );

    // SMS — quick ping so the creator doesn't miss it sitting in email.
    try {
      const { sendSms, isTwilioConfigured } = await import("./twilio");
      if (isTwilioConfigured() && creatorMember.phone) {
        const eventDateLabel = new Date(
          data.event_date + "T00:00:00"
        ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        await sendSms(
          creatorMember.phone,
          `KDER: New catering request from ${customer.display_name ?? "a customer"} for ${data.guest_count} guests on ${eventDateLabel}. Reply with a quote in your dashboard.`
        );
      }
    } catch (err) {
      console.error("[notify] catering inquiry SMS failed:", err);
    }
  } catch (err) {
    console.error("[notify] catering inquiry threw:", err);
  }
}

/**
 * Fire when a creator sends a quote. Both parties get email — customer
 * gets the full breakdown + pay link, creator gets a confirmation
 * receipt. Both threaded to the same inquiry-thread Message-ID so the
 * whole conversation groups in Gmail.
 */
export async function notifyCateringQuoteSent(args: {
  quoteId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) {
      console.error("[notify] catering quote sent: no service client");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote } = await (supabase as any)
      .from("catering_quotes")
      .select(`
        id, inquiry_id, creator_id, member_id,
        line_items, food_subtotal_cents, fees_cents, tax_cents,
        total_cents, deposit_cents, balance_cents,
        creator_notes, expires_at,
        inquiry:catering_inquiries(event_date),
        creator:creators(member:members(display_name, email, phone, handle)),
        customer:members!catering_quotes_member_id_fkey(display_name, email, phone)
      `)
      .eq("id", args.quoteId)
      .single();

    if (!quote) {
      console.error("[notify] catering quote not found:", args.quoteId);
      return;
    }

    const creator = quote.creator?.member;
    const customer = quote.customer;
    if (!creator || !customer) {
      console.error("[notify] catering quote missing join");
      return;
    }

    const thread = cateringThreadIds(quote.inquiry_id);

    const customerEmail = t.cateringQuoteSentCustomer({
      quote,
      inquiry: quote.inquiry,
      creator: { display_name: creator.display_name ?? "Your creator" },
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      "cateringQuoteSent→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringQuoteSentCreator({
      quote,
      inquiry: quote.inquiry,
      customer: { display_name: customer.display_name ?? "Customer" },
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      "cateringQuoteSent→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );

    // SMS to customer — quick "your quote arrived" ping with the link.
    try {
      const { sendSms, isTwilioConfigured } = await import("./twilio");
      if (isTwilioConfigured() && customer.phone) {
        const totalDollars = Math.round(quote.total_cents / 100);
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://kder.club"}/catering/quote/${quote.id}`;
        await sendSms(
          customer.phone,
          `KDER: ${creator.display_name ?? "Your creator"} sent you a $${totalDollars} catering quote. Review & pay deposit: ${url}`
        );
      }
    } catch (err) {
      console.error("[notify] catering quote SMS failed:", err);
    }
  } catch (err) {
    console.error("[notify] catering quote threw:", err);
  }
}

/** Fire when a customer pays the deposit. Creator-only — strong urgency
 *  because they have 4h to accept before auto-decline. */
export async function notifyCateringDepositPaid(args: {
  bookingId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, total_cents, deposit_cents, accept_deadline, event_date,
        inquiry_id, creator_id,
        creator:creators(member:members(display_name, email, phone)),
        customer:members!catering_bookings_member_id_fkey(display_name)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const email = t.cateringDepositPaidCreator({
      booking,
      customer: { display_name: customer.display_name ?? "Customer" },
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      creator.email,
      email.subject,
      email.html,
      "cateringDepositPaid→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );

    try {
      const { sendSms, isTwilioConfigured } = await import("./twilio");
      if (isTwilioConfigured() && creator.phone) {
        const deadlineLabel = booking.accept_deadline
          ? new Date(booking.accept_deadline).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "soon";
        await sendSms(
          creator.phone,
          `KDER: ${customer.display_name ?? "A customer"} paid the deposit for your catering booking. Accept by ${deadlineLabel} or it auto-declines.`
        );
      }
    } catch (err) {
      console.error("[notify] deposit paid SMS failed:", err);
    }
  } catch (err) {
    console.error("[notify] deposit paid threw:", err);
  }
}

/** Fire when the creator accepts the booking. Both parties notified. */
export async function notifyCateringBookingConfirmed(args: {
  bookingId: string;
  balanceChargeDate?: string | null;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, total_cents, balance_cents, event_date, inquiry_id,
        creator:creators(member:members(display_name, email)),
        customer:members!catering_bookings_member_id_fkey(display_name, email)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const customerEmail = t.cateringBookingConfirmedCustomer({
      booking,
      creator: { display_name: creator.display_name ?? "Your creator" },
      eventDate: booking.event_date,
      balanceChargeDate: args.balanceChargeDate,
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      "cateringBookingConfirmed→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringBookingConfirmedCreator({
      booking,
      customer: { display_name: customer.display_name ?? "Customer" },
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      "cateringBookingConfirmed→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );
  } catch (err) {
    console.error("[notify] booking confirmed threw:", err);
  }
}

/** Fire when a booking is cancelled (creator declined, auto-declined,
 *  or customer cancelled). Both parties get the email so neither is
 *  surprised by the refund or the freed-up date. */
export async function notifyCateringBookingCancelled(args: {
  bookingId: string;
  reason: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, deposit_cents, event_date, inquiry_id,
        creator:creators(member:members(display_name, email)),
        customer:members!catering_bookings_member_id_fkey(display_name, email)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const creatorCopy = t.cateringBookingCancelledBoth({
      forParty: "creator",
      otherPartyName: customer.display_name ?? "Customer",
      reason: args.reason,
      refundCents: booking.deposit_cents,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      creator.email,
      creatorCopy.subject,
      creatorCopy.html,
      "cateringBookingCancelled→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );

    const customerCopy = t.cateringBookingCancelledBoth({
      forParty: "customer",
      otherPartyName: creator.display_name ?? "Your creator",
      reason: args.reason,
      refundCents: booking.deposit_cents,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      customer.email,
      customerCopy.subject,
      customerCopy.html,
      "cateringBookingCancelled→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );
  } catch (err) {
    console.error("[notify] booking cancelled threw:", err);
  }
}

// ── PR 4 notifications: balance, reminders, expiry, completion ──

/** Sent when the balance auto-charge succeeds. Both parties. */
export async function notifyCateringBalanceCharged(args: {
  bookingId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, total_cents, balance_cents, event_date, inquiry_id,
        creator:creators(member:members(display_name, email)),
        customer:members!catering_bookings_member_id_fkey(display_name, email)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const customerEmail = t.cateringBalanceChargedBoth({
      forParty: "customer",
      otherPartyName: creator.display_name ?? "your creator",
      balanceCents: booking.balance_cents,
      totalCents: booking.total_cents,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      "cateringBalanceCharged→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringBalanceChargedBoth({
      forParty: "creator",
      otherPartyName: customer.display_name ?? "Customer",
      balanceCents: booking.balance_cents,
      totalCents: booking.total_cents,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      "cateringBalanceCharged→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );
  } catch (err) {
    console.error("[notify] balance charged threw:", err);
  }
}

/** Sent when the balance auto-charge fails. Customer gets a retry CTA;
 *  creator gets a heads-up so they're not blindsided. */
export async function notifyCateringBalanceFailed(args: {
  bookingId: string;
  reason: string;
  finalAttempt: boolean;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, balance_cents, event_date, inquiry_id,
        creator:creators(member:members(display_name, email, phone)),
        customer:members!catering_bookings_member_id_fkey(display_name, email, phone)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const customerEmail = t.cateringBalanceFailedBoth({
      forParty: "customer",
      otherPartyName: creator.display_name ?? "your creator",
      balanceCents: booking.balance_cents,
      reason: args.reason,
      bookingId: booking.id,
      finalAttempt: args.finalAttempt,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      "cateringBalanceFailed→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringBalanceFailedBoth({
      forParty: "creator",
      otherPartyName: customer.display_name ?? "Customer",
      balanceCents: booking.balance_cents,
      reason: args.reason,
      bookingId: booking.id,
      finalAttempt: args.finalAttempt,
      eventDate: booking.event_date,
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      "cateringBalanceFailed→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );

    // SMS to customer — they have to act, urgency matters.
    try {
      const { sendSms, isTwilioConfigured } = await import("./twilio");
      if (isTwilioConfigured() && customer.phone) {
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://kder.club"}/catering/bookings/${booking.id}`;
        await sendSms(
          customer.phone,
          `KDER: Your balance payment for ${creator.display_name ?? "your"} catering didn't go through. Update your card: ${url}`
        );
      }
    } catch (err) {
      console.error("[notify] balance failed SMS:", err);
    }
  } catch (err) {
    console.error("[notify] balance failed threw:", err);
  }
}

/** Pre-event reminder. Fires for both parties at one of three tiers. */
export async function notifyCateringEventReminder(args: {
  bookingId: string;
  tier: "3d" | "1d" | "morning_of";
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, event_date, event_time, inquiry_id,
        inquiry:catering_inquiries(guest_count, event_address),
        creator:creators(member:members(display_name, email, phone)),
        customer:members!catering_bookings_member_id_fkey(display_name, email, phone)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);
    const guestCount = booking.inquiry?.guest_count ?? 0;
    const eventAddress = booking.inquiry?.event_address ?? null;

    const customerEmail = t.cateringEventReminderBoth({
      forParty: "customer",
      otherPartyName: creator.display_name ?? "your creator",
      tier: args.tier,
      eventDate: booking.event_date,
      eventTime: booking.event_time,
      guestCount,
      eventAddress,
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      `cateringEventReminder-${args.tier}→customer`,
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringEventReminderBoth({
      forParty: "creator",
      otherPartyName: customer.display_name ?? "Customer",
      tier: args.tier,
      eventDate: booking.event_date,
      eventTime: booking.event_time,
      guestCount,
      eventAddress,
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      `cateringEventReminder-${args.tier}→creator`,
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );

    // SMS for 1d and morning-of tiers to both parties — these are the
    // ones with real "show up and be ready" urgency.
    if (args.tier === "1d" || args.tier === "morning_of") {
      try {
        const { sendSms, isTwilioConfigured } = await import("./twilio");
        if (isTwilioConfigured()) {
          const eventDateLabel = new Date(
            booking.event_date + "T00:00:00"
          ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const when =
            args.tier === "morning_of" ? "today" : `tomorrow (${eventDateLabel})`;
          if (creator.phone) {
            await sendSms(
              creator.phone,
              `KDER reminder: ${guestCount}-guest catering for ${customer.display_name ?? "your customer"} ${when}.`
            );
          }
          if (customer.phone) {
            await sendSms(
              customer.phone,
              `KDER reminder: Your catering with ${creator.display_name ?? "your creator"} is ${when}.`
            );
          }
        }
      } catch (err) {
        console.error("[notify] event reminder SMS:", err);
      }
    }
  } catch (err) {
    console.error("[notify] event reminder threw:", err);
  }
}

/** Sent to the CUSTOMER when an unanswered quote expires. */
export async function notifyCateringQuoteExpired(args: {
  quoteId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote } = await (supabase as any)
      .from("catering_quotes")
      .select(`
        id, member_id, inquiry_id,
        inquiry:catering_inquiries(event_date),
        creator:creators(member:members(display_name, handle)),
        customer:members!catering_quotes_member_id_fkey(display_name, email)
      `)
      .eq("id", args.quoteId)
      .single();

    if (!quote) return;
    const customer = quote.customer;
    const creator = quote.creator?.member;
    if (!customer || !creator || !quote.inquiry) return;

    const thread = cateringThreadIds(quote.inquiry_id);

    const email = t.cateringQuoteExpiredCustomer({
      creatorName: creator.display_name ?? "the creator",
      eventDate: quote.inquiry.event_date,
      creatorHandle: creator.handle ?? "",
    });
    await safeSendEmail(
      customer.email,
      email.subject,
      email.html,
      "cateringQuoteExpired→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );
  } catch (err) {
    console.error("[notify] quote expired threw:", err);
  }
}

/** Sent when the creator marks a booking complete. Both parties. */
export async function notifyCateringBookingCompleted(args: {
  bookingId: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("./supabase/service");
    const supabase = createServiceClient();
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking } = await (supabase as any)
      .from("catering_bookings")
      .select(`
        id, total_cents, event_date, inquiry_id,
        creator:creators(member:members(display_name, email)),
        customer:members!catering_bookings_member_id_fkey(display_name, email)
      `)
      .eq("id", args.bookingId)
      .single();

    if (!booking) return;
    const creator = booking.creator?.member;
    const customer = booking.customer;
    if (!creator || !customer) return;

    const thread = cateringThreadIds(booking.inquiry_id);

    const customerEmail = t.cateringBookingCompletedBoth({
      forParty: "customer",
      otherPartyName: creator.display_name ?? "your creator",
      eventDate: booking.event_date,
      totalCents: booking.total_cents,
    });
    await safeSendEmail(
      customer.email,
      customerEmail.subject,
      customerEmail.html,
      "cateringBookingCompleted→customer",
      { "In-Reply-To": `<${thread.customer}>`, References: `<${thread.customer}>` }
    );

    const creatorEmail = t.cateringBookingCompletedBoth({
      forParty: "creator",
      otherPartyName: customer.display_name ?? "Customer",
      eventDate: booking.event_date,
      totalCents: booking.total_cents,
    });
    await safeSendEmail(
      creator.email,
      creatorEmail.subject,
      creatorEmail.html,
      "cateringBookingCompleted→creator",
      { "In-Reply-To": `<${thread.creator}>`, References: `<${thread.creator}>` }
    );
  } catch (err) {
    console.error("[notify] booking completed threw:", err);
  }
}
