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

// ── Catering ─────────────────────────────────────────────────

/** First-touch template when a customer submits a catering inquiry.
 *  Sent to the creator only. CTA points at the new inquiry detail page
 *  so they can read the full request and click "Build Quote" in one
 *  hop. PR 3 will add the quote-sent / deposit-paid / balance-charged
 *  templates that share the same Message-ID thread. */
export function cateringInquiryReceivedCreator(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inquiry: any; // shape: row from catering_inquiries with snake_case columns
  creator: { display_name: string; handle: string; email: string | null };
  customer: { display_name: string; email: string | null };
}) {
  const { inquiry, customer } = args;
  // `creator` arg is reserved for personalization in a follow-up pass
  // (e.g., "Hi {creator.display_name}, ..."). Kept in the signature so
  // the call site doesn't need to change later.
  void args.creator;
  const eventDateLabel = new Date(
    inquiry.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTimeLabel = inquiry.event_time
    ? new Date(`2000-01-01T${inquiry.event_time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const rows: string[] = [
    `<tr><td style="padding:6px 0;color:#666;width:140px">Date</td><td style="padding:6px 0;font-weight:600">${eventDateLabel}${eventTimeLabel ? ` at ${eventTimeLabel}` : ""}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#666">Guests</td><td style="padding:6px 0;font-weight:600">${inquiry.guest_count}</td></tr>`,
  ];
  if (inquiry.event_address) {
    rows.push(
      `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Location</td><td style="padding:6px 0;font-weight:600">${escapeHtml(inquiry.event_address)}</td></tr>`
    );
  }
  if (inquiry.event_venue_type) {
    rows.push(
      `<tr><td style="padding:6px 0;color:#666">Venue type</td><td style="padding:6px 0">${inquiry.event_venue_type}</td></tr>`
    );
  }
  if (inquiry.needs_server || inquiry.needs_setup) {
    const extras = [
      inquiry.needs_server ? "server" : null,
      inquiry.needs_setup ? "setup" : null,
    ]
      .filter(Boolean)
      .join(" + ");
    rows.push(
      `<tr><td style="padding:6px 0;color:#666">Extras</td><td style="padding:6px 0">${extras}</td></tr>`
    );
  }
  if (inquiry.allergies) {
    rows.push(
      `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Allergies</td><td style="padding:6px 0">${escapeHtml(inquiry.allergies)}</td></tr>`
    );
  }

  const notesBlock = inquiry.notes
    ? `<p style="background:#f5f5f5;border-left:3px solid #2E7D32;padding:10px 14px;border-radius:0 8px 8px 0;color:#333">${escapeHtml(inquiry.notes)}</p>`
    : "";

  return {
    subject: `New catering request from ${customer.display_name} — ${eventDateLabel}`,
    html: shell(
      `New catering request`,
      `<p>${escapeHtml(customer.display_name)} is asking about catering for an event:</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
         ${rows.join("")}
       </table>
       ${notesBlock}
       <p>Open the request to send back a quote with line items and a deposit total.</p>`,
      `${APP_URL}/catering/inquiries/${inquiry.id}`,
      "Open & build quote"
    ),
  };
}

/** Minimal HTML escape — sufficient for the limited surface area of
 *  user-typed fields (address, allergies, notes). Don't render
 *  user content without this. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Catering quote / booking templates (PR 3) ───────────────────

interface QuoteLineItem {
  name: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
}

/** Format an int cents value as a dollar amount. Whole-dollar amounts
 *  drop the .00 to stay clean ("$200" not "$200.00"). */
function money(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/** Quote line-items table — reused across customer + creator copies. */
function lineItemsTable(items: QuoteLineItem[]): string {
  const rows = items
    .map(
      (it) =>
        `<tr>
          <td style="padding:8px 0;color:#222">${escapeHtml(it.name)}${it.qty > 1 ? ` <span style="color:#666">× ${it.qty}</span>` : ""}</td>
          <td style="padding:8px 0;text-align:right;color:#222">${money(it.total_cents)}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
    ${rows}
  </table>`;
}

function totalsBlock(args: {
  foodSubtotalCents: number;
  feesCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
}): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border-top:1px solid #eee;margin-top:12px;font-size:14px">
    <tr><td style="padding:6px 0;color:#666">Food subtotal</td><td style="padding:6px 0;text-align:right">${money(args.foodSubtotalCents)}</td></tr>
    ${args.feesCents > 0 ? `<tr><td style="padding:6px 0;color:#666">Fees (delivery, labor)</td><td style="padding:6px 0;text-align:right">${money(args.feesCents)}</td></tr>` : ""}
    ${args.taxCents > 0 ? `<tr><td style="padding:6px 0;color:#666">Tax</td><td style="padding:6px 0;text-align:right">${money(args.taxCents)}</td></tr>` : ""}
    <tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:700">Total</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:700">${money(args.totalCents)}</td></tr>
    <tr><td style="padding:6px 0;color:#2E7D32">Due now (deposit)</td><td style="padding:6px 0;text-align:right;color:#2E7D32;font-weight:700">${money(args.depositCents)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Balance (charged before event)</td><td style="padding:6px 0;text-align:right;color:#666">${money(args.balanceCents)}</td></tr>
  </table>`;
}

/** Sent to the CUSTOMER when the creator builds a quote. Full line-item
 *  table + a "Review & Pay Deposit" CTA pointing at the standalone
 *  quote page so the link is shareable + works from inbox. */
export function cateringQuoteSentCustomer(args: {
  quote: {
    id: string;
    line_items: QuoteLineItem[];
    food_subtotal_cents: number;
    fees_cents: number;
    tax_cents: number;
    total_cents: number;
    deposit_cents: number;
    balance_cents: number;
    expires_at: string;
    creator_notes: string | null;
  };
  inquiry: { event_date: string };
  creator: { display_name: string };
}) {
  const { quote, inquiry, creator } = args;
  const eventDateLabel = new Date(
    inquiry.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const expiresLabel = new Date(quote.expires_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const notesBlock = quote.creator_notes
    ? `<p style="background:#f5f5f5;border-left:3px solid #2E7D32;padding:10px 14px;border-radius:0 8px 8px 0;color:#333;margin:12px 0">${escapeHtml(quote.creator_notes)}</p>`
    : "";

  return {
    subject: `Your quote from ${creator.display_name} — ${money(quote.total_cents)} for ${eventDateLabel}`,
    html: shell(
      `Your catering quote`,
      `<p>${escapeHtml(creator.display_name)} sent a quote for your ${eventDateLabel} event:</p>
       ${lineItemsTable(quote.line_items)}
       ${totalsBlock({
         foodSubtotalCents: quote.food_subtotal_cents,
         feesCents: quote.fees_cents,
         taxCents: quote.tax_cents,
         totalCents: quote.total_cents,
         depositCents: quote.deposit_cents,
         balanceCents: quote.balance_cents,
       })}
       ${notesBlock}
       <p style="margin-top:16px;color:#666;font-size:13px">
         Pay the ${money(quote.deposit_cents)} deposit to lock in the date.
         The remaining ${money(quote.balance_cents)} balance is auto-charged a
         few days before your event.
       </p>
       <p style="color:#666;font-size:13px">
         This quote expires <strong>${expiresLabel}</strong>.
       </p>`,
      `${APP_URL}/catering/quote/${quote.id}`,
      "Review & Pay Deposit"
    ),
  };
}

/** Sent to the CREATOR as a "yep, your quote went out" receipt. */
export function cateringQuoteSentCreator(args: {
  quote: { id: string; total_cents: number; deposit_cents: number };
  customer: { display_name: string };
  inquiry: { event_date: string };
}) {
  const { quote, customer, inquiry } = args;
  const eventDateLabel = new Date(
    inquiry.event_date + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return {
    subject: `Quote sent to ${customer.display_name} — ${money(quote.total_cents)}`,
    html: shell(
      `Quote sent`,
      `<p>Your ${money(quote.total_cents)} quote was emailed to ${escapeHtml(customer.display_name)} for the ${eventDateLabel} event.</p>
       <p style="color:#666;font-size:13px">
         You'll get notified the moment they pay the ${money(quote.deposit_cents)} deposit.
       </p>`,
      `${APP_URL}/catering/inquiries`,
      "Open your inquiries"
    ),
  };
}

/** Sent to the CREATOR when the customer pays the deposit. 4-hour
 *  acceptance window starts ticking — urgency in the subject. */
export function cateringDepositPaidCreator(args: {
  booking: {
    id: string;
    total_cents: number;
    deposit_cents: number;
    accept_deadline: string | null;
  };
  customer: { display_name: string };
  eventDate: string;
}) {
  const { booking, customer, eventDate } = args;
  const eventDateLabel = new Date(eventDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const deadlineLabel = booking.accept_deadline
    ? new Date(booking.accept_deadline).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    : "soon";
  return {
    subject: `${customer.display_name} paid the deposit — accept by ${deadlineLabel}`,
    html: shell(
      `Deposit paid — accept within 4 hours`,
      `<p><strong>${escapeHtml(customer.display_name)}</strong> just paid the ${money(booking.deposit_cents)} deposit for the ${eventDateLabel} catering booking.</p>
       <p>You have <strong>until ${deadlineLabel}</strong> to accept. If you don't accept by then, the booking auto-declines and the deposit is refunded.</p>`,
      `${APP_URL}/catering/inquiries`,
      "Accept booking"
    ),
  };
}

/** Sent to the CUSTOMER when the creator accepts the booking. */
export function cateringBookingConfirmedCustomer(args: {
  booking: { id: string; total_cents: number; balance_cents: number };
  creator: { display_name: string };
  eventDate: string;
  balanceChargeDate?: string | null;
}) {
  const { booking, creator, eventDate, balanceChargeDate } = args;
  const eventDateLabel = new Date(eventDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );
  const balanceLabel = balanceChargeDate
    ? new Date(balanceChargeDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "a few days before the event";
  return {
    subject: `Booking confirmed with ${creator.display_name} — ${eventDateLabel}`,
    html: shell(
      `You're booked`,
      `<p>${escapeHtml(creator.display_name)} accepted your catering booking for <strong>${eventDateLabel}</strong>.</p>
       <p>The remaining <strong>${money(booking.balance_cents)}</strong> balance will be auto-charged to the same card on <strong>${balanceLabel}</strong>.</p>
       <p style="color:#666;font-size:13px">No need to do anything until then — we'll send a reminder before each charge.</p>`,
      `${APP_URL}`,
      "Back to KDER"
    ),
  };
}

/** Sent to the CREATOR confirming their own acceptance. Lighter copy. */
export function cateringBookingConfirmedCreator(args: {
  booking: { id: string };
  customer: { display_name: string };
  eventDate: string;
}) {
  const { customer, eventDate } = args;
  const eventDateLabel = new Date(eventDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  return {
    subject: `Booking confirmed: ${customer.display_name} on ${eventDateLabel}`,
    html: shell(
      `Booking confirmed`,
      `<p>You accepted ${escapeHtml(customer.display_name)}'s booking for ${eventDateLabel}. We let them know.</p>
       <p style="color:#666;font-size:13px">It's on your Calendar tab. The balance auto-charges a few days before the event — you'll get notified when it lands.</p>`,
      `${APP_URL}/catering/calendar`,
      "Open Calendar"
    ),
  };
}

/** Sent to BOTH parties when a booking is cancelled (creator declined,
 *  auto-declined past the 4h window, or customer cancelled). */
export function cateringBookingCancelledBoth(args: {
  forParty: "creator" | "customer";
  otherPartyName: string;
  reason: string;
  refundCents: number;
  eventDate: string;
}) {
  const { forParty, otherPartyName, reason, refundCents, eventDate } = args;
  const eventDateLabel = new Date(eventDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const body =
    forParty === "creator"
      ? `<p>The catering booking with ${escapeHtml(otherPartyName)} for ${eventDateLabel} has been cancelled.</p>
         <p style="color:#666;font-size:13px">${escapeHtml(reason)}</p>
         <p style="color:#666;font-size:13px">Their deposit has been refunded.</p>`
      : `<p>Your catering booking with ${escapeHtml(otherPartyName)} for ${eventDateLabel} has been cancelled.</p>
         <p style="color:#666;font-size:13px">${escapeHtml(reason)}</p>
         <p>Your <strong>${money(refundCents)}</strong> deposit has been refunded — it should appear on your card in 5-10 business days.</p>`;
  return {
    subject: `Catering booking cancelled — ${eventDateLabel}`,
    html: shell(`Booking cancelled`, body, APP_URL, "Back to KDER"),
  };
}
