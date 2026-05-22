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
  label: string
): Promise<void> {
  if (!to) {
    console.log(`[notifications] Skipped ${label} — no recipient email`);
    return;
  }
  try {
    const res = await sendEmail({ to, subject, html });
    if (!res.success) {
      console.error(`[notifications] ${label} failed:`, res.error);
    }
  } catch (err) {
    console.error(`[notifications] ${label} threw:`, err);
  }
}

export async function notifyOrderPlaced(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  // Creator gets the urgent "you have a new order" email
  const c = t.orderPlacedCreator({ order, creator, member });
  await safeSendEmail(creator.email, c.subject, c.html, "orderPlaced→creator");

  // Customer gets the confirmation
  const m = t.orderPlacedCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderPlaced→customer");
}

export async function notifyOrderReminder(
  order: Order,
  creator: CreatorContext,
  member: MemberContext,
  reminderNumber: 1 | 2 | 3 | 4
): Promise<void> {
  const c = t.orderReminderCreator({ order, creator, member, reminderNumber });
  await safeSendEmail(
    creator.email,
    c.subject,
    c.html,
    `orderReminder#${reminderNumber}→creator`
  );
}

export async function notifyOrderAccepted(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const m = t.orderAcceptedCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderAccepted→customer");
}

export async function notifyOrderReady(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const m = t.orderReadyCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderReady→customer");
}

export async function notifyOrderCompleted(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const m = t.orderCompletedCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderCompleted→customer");
}

export async function notifyOrderDeclined(
  order: Order,
  creator: CreatorContext,
  member: MemberContext
): Promise<void> {
  const m = t.orderDeclinedCustomer({ order, creator });
  await safeSendEmail(member.email, m.subject, m.html, "orderDeclined→customer");
}
