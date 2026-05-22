/**
 * Plain-HTML email templates for order events. One function per event,
 * each returning `{ subject, html }`. Kept as plain HTML strings
 * (no React Email yet) for simplicity — when the template count grows
 * past ~10 or branding gets richer, migrate to @react-email/components.
 *
 * Brand: dark green + cream, mobile-friendly single-column layout,
 * 600px max width (industry standard for inbox clients).
 */

import type { Order } from "@/types";

interface CreatorLite {
  display_name: string;
  handle: string;
}

interface MemberLite {
  display_name: string;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://kder.club";

function shell(headline: string, bodyHtml: string, ctaHref?: string, ctaLabel?: string): string {
  const cta = ctaHref && ctaLabel
    ? `<tr><td style="padding:8px 24px 24px"><a href="${ctaHref}" style="display:inline-block;background:#1B5E20;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:9999px;font-size:14px">${ctaLabel}</a></td></tr>`
    : "";

  return `<!doctype html><html><body style="margin:0;padding:0;background:#F5F1E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0A0A0A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F1E8;padding:24px 16px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px 24px 8px"><div style="font-size:18px;font-weight:900;letter-spacing:0.04em;color:#2E7D32">KDER</div></td></tr>
<tr><td style="padding:0 24px 16px"><h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800">${headline}</h1></td></tr>
<tr><td style="padding:0 24px 16px;font-size:15px;line-height:1.55;color:#222">${bodyHtml}</td></tr>
${cta}
<tr><td style="padding:16px 24px 24px;border-top:1px solid #eee;font-size:12px;color:#666">You're getting this because you're using KDER. Reply to this email if you need help — a real person reads every reply.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function dollars(cents: number): string {
  return `$${cents.toFixed(2)}`;
}

// ── Creator-side ─────────────────────────────────────────────

export function orderPlacedCreator(args: {
  order: Order;
  creator: CreatorLite;
  member: MemberLite;
}) {
  const { order, creator, member } = args;
  return {
    subject: `New order from ${member.display_name} — ${dollars(order.total_amount)}`,
    html: shell(
      `New order, ${creator.display_name.split(" ")[0]} 🎉`,
      `<p><strong>${member.display_name}</strong> ordered <strong>${order.listing_name} × ${order.quantity}</strong> for <strong>${dollars(order.total_amount)}</strong>.</p>
       <p>Open the order to accept and confirm pickup or delivery details.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "Accept this order"
    ),
  };
}

export function orderReminderCreator(args: {
  order: Order;
  creator: CreatorLite;
  member: MemberLite;
  reminderNumber: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const { order, creator, member, reminderNumber } = args;
  const tone = [
    { headline: "New order waiting on you",          urgency: "It's been 15 minutes — accept or decline so your customer knows what's happening." },
    { headline: "Order still pending (30 min)",       urgency: "30 minutes and no response. Your customer is still waiting." },
    { headline: "45-minute reminder",                 urgency: "45 minutes have passed. Please respond as soon as you can." },
    { headline: "One hour — customer still waiting",  urgency: "It's been an hour. Customers usually move on if they don't hear back soon." },
    { headline: "90 minutes — urgent",                urgency: "An hour and a half with no response. Your customer may be looking elsewhere." },
    { headline: "Final reminder — 2 hours",           urgency: "It's been 2 hours. Please accept or decline this order right now." },
  ][reminderNumber - 1];

  return {
    subject: `Reminder: order from ${member.display_name} still pending`,
    html: shell(
      tone.headline,
      `<p>Hey ${creator.display_name.split(" ")[0]}, ${tone.urgency}</p>
       <p><strong>${member.display_name}</strong> · ${order.listing_name} × ${order.quantity} · <strong>${dollars(order.total_amount)}</strong></p>`,
      `${APP_URL}/orders/${order.id}`,
      "Open the order"
    ),
  };
}

// ── Customer-side ────────────────────────────────────────────

export function orderPlacedCustomer(args: {
  order: Order;
  creator: CreatorLite;
}) {
  const { order, creator } = args;
  return {
    subject: `Order placed with ${creator.display_name}`,
    html: shell(
      "Your order is in 🍽️",
      `<p>You ordered <strong>${order.listing_name} × ${order.quantity}</strong> from <strong>${creator.display_name}</strong> for <strong>${dollars(order.total_amount)}</strong>.</p>
       <p>${creator.display_name.split(" ")[0]} will confirm soon. We'll text and email you the moment they accept and share pickup details.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View your order"
    ),
  };
}

export function orderAcceptedCustomer(args: {
  order: Order;
  creator: CreatorLite;
}) {
  const { order, creator } = args;
  return {
    subject: `${creator.display_name} accepted your order`,
    html: shell(
      "Your order is confirmed 🎉",
      `<p><strong>${creator.display_name}</strong> accepted your order for <strong>${order.listing_name} × ${order.quantity}</strong>.</p>
       <p>You'll hear from them again when it's ready.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View your order"
    ),
  };
}

export function orderReadyCustomer(args: {
  order: Order;
  creator: CreatorLite;
}) {
  const { order, creator } = args;
  return {
    subject: `Your order from ${creator.display_name} is ready`,
    html: shell(
      "Your order is ready 🚀",
      `<p><strong>${creator.display_name}</strong> just marked your <strong>${order.listing_name}</strong> ready.</p>
       <p>Open the order for pickup details.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "Get pickup details"
    ),
  };
}

export function orderCompletedCustomer(args: {
  order: Order;
  creator: CreatorLite;
}) {
  const { order, creator } = args;
  return {
    subject: `Hope you enjoyed your order from ${creator.display_name}`,
    html: shell(
      "Thanks for ordering on KDER",
      `<p>Your order from <strong>${creator.display_name}</strong> is complete. Hope it was good.</p>
       <p>If you'd rate the experience, ${creator.display_name.split(" ")[0]} would really appreciate it — that's how new neighbors find them.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "Leave a rating"
    ),
  };
}

export function orderDeclinedCustomer(args: {
  order: Order;
  creator: CreatorLite;
}) {
  const { order, creator } = args;
  return {
    subject: `${creator.display_name} couldn't take your order`,
    html: shell(
      "Order couldn't be confirmed",
      `<p>Sorry — <strong>${creator.display_name}</strong> wasn't able to take your order for <strong>${order.listing_name}</strong>.</p>
       <p>Your card hasn't been charged. Browse other Houston creators or try again later.</p>`,
      `${APP_URL}`,
      "Browse other creators"
    ),
  };
}

export function orderAcceptedCreator(args: {
  order: Order;
  member: MemberLite;
}) {
  const { order, member } = args;
  return {
    subject: `You confirmed ${member.display_name}'s order`,
    html: shell(
      "Order confirmed ✓",
      `<p>You accepted <strong>${member.display_name}</strong>'s order for <strong>${order.listing_name} × ${order.quantity}</strong>.</p>
       <p>They've been notified. Mark it ready when it's time for pickup or delivery.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View order"
    ),
  };
}

export function orderReadyCreator(args: {
  order: Order;
  member: MemberLite;
}) {
  const { order, member } = args;
  return {
    subject: `You marked ${member.display_name}'s order as ready`,
    html: shell(
      "Order marked ready",
      `<p>You marked <strong>${member.display_name}</strong>'s <strong>${order.listing_name}</strong> as ready. They've been notified to come pick it up.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View order"
    ),
  };
}

export function orderCompletedCreator(args: {
  order: Order;
  member: MemberLite;
}) {
  const { order, member } = args;
  return {
    subject: `Order complete — you earned ${dollars(order.creator_payout)}`,
    html: shell(
      "Order complete 💰",
      `<p><strong>${member.display_name}</strong>'s order for <strong>${order.listing_name} × ${order.quantity}</strong> is done.</p>
       <p>You earned <strong>${dollars(order.creator_payout)}</strong> on this order (after platform fee).</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View order"
    ),
  };
}

export function orderDeclinedCreator(args: {
  order: Order;
  member: MemberLite;
}) {
  const { order, member } = args;
  return {
    subject: `You declined ${member.display_name}'s order`,
    html: shell(
      "Order declined",
      `<p>You declined <strong>${member.display_name}</strong>'s order for <strong>${order.listing_name} × ${order.quantity}</strong>.</p>
       <p>They won't be charged. If this was a mistake, reach out to them directly.</p>`,
      `${APP_URL}/orders/${order.id}`,
      "View order"
    ),
  };
}

// ── Message notifications ────────────────────────────────────

export function newMessageRecipient(args: {
  senderName: string;
  messagePreview: string;
  orderId: string | null;
  creatorHandle: string | null;
}) {
  const { senderName, messagePreview, orderId, creatorHandle } = args;
  const ctaHref = orderId
    ? `${APP_URL}/orders/${orderId}`
    : creatorHandle
      ? `${APP_URL}/@${creatorHandle}`
      : APP_URL;
  const preview =
    messagePreview.length > 120
      ? messagePreview.slice(0, 120) + "…"
      : messagePreview;
  return {
    subject: `New message from ${senderName} on KDER`,
    html: shell(
      `Message from ${senderName}`,
      `<p style="background:#f5f5f5;border-left:3px solid #2E7D32;padding:10px 14px;border-radius:0 8px 8px 0;font-style:italic;color:#333">${preview}</p>
       <p>Reply in the app to keep the conversation going.</p>`,
      ctaHref,
      "Reply now"
    ),
  };
}
