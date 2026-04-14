import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  _resetForTesting,
} from "@/lib/rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("phone1", 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests over the limit", () => {
    checkRateLimit("phone1", 3, 60000);
    checkRateLimit("phone1", 3, 60000);
    checkRateLimit("phone1", 3, 60000);
    const result = checkRateLimit("phone1", 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks different keys independently", () => {
    checkRateLimit("phone1", 1, 60000);
    const result = checkRateLimit("phone2", 1, 60000);
    expect(result.allowed).toBe(true);
  });

  it("returns correct remaining count", () => {
    const r1 = checkRateLimit("phone1", 5, 60000);
    expect(r1.remaining).toBe(4);
    const r2 = checkRateLimit("phone1", 5, 60000);
    expect(r2.remaining).toBe(3);
  });

  it("resets properly for testing", () => {
    checkRateLimit("phone1", 1, 60000);
    _resetForTesting();
    const result = checkRateLimit("phone1", 1, 60000);
    expect(result.allowed).toBe(true);
  });
});
