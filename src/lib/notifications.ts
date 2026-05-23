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
