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
  reminderNumber: 1 | 2 | 3 | 4
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
