import type { DiscountCode } from "@/types";

/**
 * Creator promo-code helpers (migration 024). Shared by:
 *  - the creator-settings save path (sanitize before persist), and
 *  - the checkout route (validate + apply, server-authoritative).
 *
 * All money is in CENTS here to match the rest of the checkout math
 * (`price_cents`, `subtotalCents`). A percentage code stores `value`
 * as 1–100; a fixed code stores `value` as cents off.
 */

export const MAX_DISCOUNT_CODES = 20;
const CODE_MIN_LEN = 3;
const CODE_MAX_LEN = 20;
/** Fixed-amount ceiling: $1,000 off. Percentage is capped at 100. */
const MAX_FIXED_CENTS = 1_000_00;
const MAX_MIN_ORDER_CENTS = 100_000_00;

/** Normalize a raw code string to its canonical stored/compared form:
 *  uppercased, stripped to A–Z0–9. Used both when sanitizing on save
 *  and when matching a customer-entered code at checkout. */
export function normalizeCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_MAX_LEN);
}

/** Never trust client shape. Coerce an incoming `discount_codes`
 *  payload into a clean, deduped DiscountCode[]:
 *   - reject non-arrays; cap at MAX_DISCOUNT_CODES
 *   - code: normalized A–Z0–9, 3–20 chars; drop shorter; dedupe
 *   - type: must be "percentage" | "fixed", else drop the row
 *   - value: percentage clamped 1–100; fixed clamped 1..MAX_FIXED_CENTS;
 *     drop rows whose value rounds to <= 0
 *   - min_order: null or an integer >= 0 cents (capped)
 *   - expires_at: null or a parseable ISO date (stored as-is), else null
 */
export function sanitizeDiscountCodes(raw: unknown): DiscountCode[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscountCode[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = item as any;

    const code = normalizeCode(r.code);
    if (code.length < CODE_MIN_LEN) continue;
    if (seen.has(code)) continue;

    const type = r.type === "fixed" ? "fixed" : r.type === "percentage" ? "percentage" : null;
    if (!type) continue;

    let value = Math.floor(Number(r.value) || 0);
    if (type === "percentage") {
      value = Math.min(100, Math.max(1, value));
    } else {
      value = Math.min(MAX_FIXED_CENTS, Math.max(1, value));
    }
    if (value <= 0) continue;

    let min_order: number | null = null;
    if (r.min_order !== null && r.min_order !== undefined && r.min_order !== "") {
      const mo = Math.floor(Number(r.min_order) || 0);
      min_order = Math.min(MAX_MIN_ORDER_CENTS, Math.max(0, mo));
    }

    let expires_at: string | null = null;
    if (typeof r.expires_at === "string" && r.expires_at.trim()) {
      const t = Date.parse(r.expires_at);
      if (!Number.isNaN(t)) expires_at = r.expires_at.trim().slice(0, 40);
    }

    seen.add(code);
    out.push({ code, type, value, min_order, expires_at });
    if (out.length >= MAX_DISCOUNT_CODES) break;
  }
  return out;
}

export type DiscountResult =
  | { ok: true; code: DiscountCode; discountCents: number }
  | { ok: false; reason: "not_found" | "expired" | "min_order"; minOrderCents?: number };

/**
 * Validate a customer-entered code against a creator's server-side
 * code list and compute the discount in cents. `subtotalCents` is the
 * pre-discount FOOD subtotal (plates + extras, excluding delivery).
 *
 * The computed discount never exceeds the subtotal (a fixed code
 * bigger than the order zeroes the food but can't go negative).
 */
export function applyDiscount(
  rawCode: unknown,
  codes: DiscountCode[] | undefined,
  subtotalCents: number,
  now: Date = new Date()
): DiscountResult {
  const wanted = normalizeCode(rawCode);
  if (!wanted) return { ok: false, reason: "not_found" };

  const match = (codes ?? []).find((c) => normalizeCode(c.code) === wanted);
  if (!match) return { ok: false, reason: "not_found" };

  if (match.expires_at) {
    const exp = Date.parse(match.expires_at);
    // Treat a date-only string as end-of-day so a code "expiring Aug 1"
    // is still valid through Aug 1 in the server's timezone.
    if (!Number.isNaN(exp) && now.getTime() > endOfDay(exp)) {
      return { ok: false, reason: "expired" };
    }
  }

  if (match.min_order != null && subtotalCents < match.min_order) {
    return { ok: false, reason: "min_order", minOrderCents: match.min_order };
  }

  const rawDiscount =
    match.type === "percentage"
      ? Math.round(subtotalCents * (Math.min(100, Math.max(0, match.value)) / 100))
      : Math.max(0, Math.floor(match.value));
  const discountCents = Math.min(rawDiscount, subtotalCents);

  return { ok: true, code: match, discountCents };
}

/** If the parsed timestamp is midnight (a date-only value), push it to
 *  23:59:59.999 so same-day expiries stay valid all day. Timestamps that
 *  already carry a time component are returned unchanged. */
function endOfDay(ts: number): number {
  const d = new Date(ts);
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return ts + 24 * 60 * 60 * 1000 - 1;
  }
  return ts;
}
