import { describe, it, expect } from "vitest";
import {
  sanitizeDiscountCodes,
  applyDiscount,
  normalizeCode,
} from "@/lib/discount-codes";
import type { DiscountCode } from "@/types";

// Mirror of the checkout route's proportional fee model (migration 024)
// so the test locks the money math independently of the route wiring.
const PLATFORM_FEE_PERCENT = 10;
function computeSplit(subtotalCents: number, discountCents: number) {
  const discountedSubtotalCents = subtotalCents - discountCents;
  const platformFeeCents = Math.round(
    discountedSubtotalCents * (PLATFORM_FEE_PERCENT / 100)
  );
  const creatorPayoutCents = discountedSubtotalCents - platformFeeCents;
  return { discountedSubtotalCents, platformFeeCents, creatorPayoutCents };
}

describe("sanitizeDiscountCodes", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeDiscountCodes(undefined)).toEqual([]);
    expect(sanitizeDiscountCodes(null)).toEqual([]);
    expect(sanitizeDiscountCodes("SUMMER10")).toEqual([]);
    expect(sanitizeDiscountCodes({})).toEqual([]);
  });

  it("normalizes code to uppercase A-Z0-9 and trims length", () => {
    const [c] = sanitizeDiscountCodes([
      { code: " summer 10! ", type: "percentage", value: 10 },
    ]);
    expect(c.code).toBe("SUMMER10");
  });

  it("drops codes shorter than 3 chars after normalization", () => {
    expect(
      sanitizeDiscountCodes([{ code: "a!", type: "percentage", value: 10 }])
    ).toEqual([]);
  });

  it("dedupes case-insensitively, keeping the first", () => {
    const out = sanitizeDiscountCodes([
      { code: "SAVE5", type: "fixed", value: 500 },
      { code: "save5", type: "fixed", value: 999 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(500);
  });

  it("drops rows with an invalid type", () => {
    expect(
      sanitizeDiscountCodes([{ code: "NOPE1", type: "bogus", value: 10 }])
    ).toEqual([]);
  });

  it("clamps percentage to a 100 ceiling", () => {
    expect(
      sanitizeDiscountCodes([{ code: "BIG", type: "percentage", value: 250 }])[0]
        .value
    ).toBe(100);
  });

  it("keeps a percentage of 0 as clamped-to-1 (not dropped)", () => {
    const out = sanitizeDiscountCodes([
      { code: "MINPCT", type: "percentage", value: 0 },
    ]);
    expect(out[0].value).toBe(1);
  });

  it("clamps fixed value to >= 1 cent and drops zero", () => {
    const out = sanitizeDiscountCodes([
      { code: "FREE", type: "fixed", value: 0 },
    ]);
    // 0 clamps to 1 (min), so it's kept at 1 cent.
    expect(out[0].value).toBe(1);
  });

  it("coerces min_order and expires_at", () => {
    const [c] = sanitizeDiscountCodes([
      {
        code: "OVER25",
        type: "percentage",
        value: 15,
        min_order: 2500,
        expires_at: "2026-08-01",
      },
    ]);
    expect(c.min_order).toBe(2500);
    expect(c.expires_at).toBe("2026-08-01");
  });

  it("nulls a malformed expires_at", () => {
    const [c] = sanitizeDiscountCodes([
      { code: "BADDATE", type: "percentage", value: 10, expires_at: "not-a-date" },
    ]);
    expect(c.expires_at).toBeNull();
  });

  it("caps the list at 20 codes", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      code: `CODE${i}`,
      type: "percentage" as const,
      value: 5,
    }));
    expect(sanitizeDiscountCodes(many)).toHaveLength(20);
  });
});

describe("normalizeCode", () => {
  it("matches creator-stored and customer-typed variants", () => {
    expect(normalizeCode("summer-10")).toBe("SUMMER10");
    expect(normalizeCode("SUMMER10")).toBe("SUMMER10");
    expect(normalizeCode(42)).toBe("");
  });
});

describe("applyDiscount", () => {
  const pct10: DiscountCode = {
    code: "SUMMER10",
    type: "percentage",
    value: 10,
    min_order: null,
    expires_at: null,
  };
  const fixed5: DiscountCode = {
    code: "SAVE5",
    type: "fixed",
    value: 500,
    min_order: null,
    expires_at: null,
  };

  it("returns not_found for an unknown or empty code", () => {
    expect(applyDiscount("NOPE", [pct10], 5000).ok).toBe(false);
    expect(applyDiscount("", [pct10], 5000)).toMatchObject({
      ok: false,
      reason: "not_found",
    });
  });

  it("computes a percentage discount and the proportional split", () => {
    const res = applyDiscount("summer10", [pct10], 5000);
    expect(res).toMatchObject({ ok: true, discountCents: 500 });
    // $50 food, $5 off -> platform fee 10% of $45 = $4.50, creator nets $40.50
    const split = computeSplit(5000, 500);
    expect(split.discountedSubtotalCents).toBe(4500);
    expect(split.platformFeeCents).toBe(450);
    expect(split.creatorPayoutCents).toBe(4050);
  });

  it("computes a fixed discount", () => {
    const res = applyDiscount("SAVE5", [fixed5], 5000);
    expect(res).toMatchObject({ ok: true, discountCents: 500 });
  });

  it("clamps a fixed discount larger than the subtotal (never negative)", () => {
    const big: DiscountCode = { ...fixed5, code: "HUGE", value: 100000 };
    const res = applyDiscount("HUGE", [big], 3000);
    expect(res).toMatchObject({ ok: true, discountCents: 3000 });
    const split = computeSplit(3000, 3000);
    expect(split.discountedSubtotalCents).toBe(0);
    expect(split.platformFeeCents).toBe(0);
    expect(split.creatorPayoutCents).toBe(0);
  });

  it("rejects when subtotal is below min_order", () => {
    const gated: DiscountCode = { ...pct10, code: "OVER25", min_order: 2500 };
    expect(applyDiscount("OVER25", [gated], 2000)).toMatchObject({
      ok: false,
      reason: "min_order",
      minOrderCents: 2500,
    });
    // exactly at the minimum qualifies
    expect(applyDiscount("OVER25", [gated], 2500).ok).toBe(true);
  });

  it("rejects an expired code but honors a same-day expiry", () => {
    const expired: DiscountCode = {
      ...pct10,
      code: "OLD",
      expires_at: "2020-01-01",
    };
    expect(applyDiscount("OLD", [expired], 5000)).toMatchObject({
      ok: false,
      reason: "expired",
    });
    const sameDay: DiscountCode = {
      ...pct10,
      code: "TODAY",
      expires_at: "2026-07-17",
    };
    // Evaluated at midday on the expiry date — still valid through EOD.
    const noon = new Date("2026-07-17T12:00:00Z");
    expect(applyDiscount("TODAY", [sameDay], 5000, noon).ok).toBe(true);
  });

  it("baseline (no code) leaves the full 10% fee intact", () => {
    const split = computeSplit(5000, 0);
    expect(split.platformFeeCents).toBe(500);
    expect(split.creatorPayoutCents).toBe(4500);
  });
});
