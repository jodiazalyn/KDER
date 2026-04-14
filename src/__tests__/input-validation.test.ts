import { describe, it, expect } from "vitest";
import {
  validatePhone,
  validateHandle,
  validateZip,
  validatePrice,
  validateQuantity,
  sanitizeText,
} from "@/lib/validation";

describe("Input Validation", () => {
  describe("validatePhone()", () => {
    it("accepts valid US phone +1XXXXXXXXXX", () => {
      expect(validatePhone("+13234906633")).toBe(true);
    });

    it("rejects phone without +1 prefix", () => {
      expect(validatePhone("3234906633")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validatePhone("")).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(validatePhone("   ")).toBe(false);
    });

    it("rejects too short", () => {
      expect(validatePhone("+1323")).toBe(false);
    });

    it("rejects too long", () => {
      expect(validatePhone("+132349066331")).toBe(false);
    });

    it("rejects non-numeric characters", () => {
      expect(validatePhone("+1323abc6633")).toBe(false);
    });
  });

  describe("validateHandle()", () => {
    it("accepts valid handle", () => {
      expect(validateHandle("mystore")).toBe(true);
    });

    it("accepts underscores and numbers", () => {
      expect(validateHandle("my_store_123")).toBe(true);
    });

    it("rejects too short (< 3)", () => {
      expect(validateHandle("ab")).toBe(false);
    });

    it("rejects too long (> 30)", () => {
      expect(validateHandle("a".repeat(31))).toBe(false);
    });

    it("rejects special characters", () => {
      expect(validateHandle("my-store")).toBe(false);
      expect(validateHandle("my store")).toBe(false);
      expect(validateHandle("my@store")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateHandle("")).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(validateHandle("   ")).toBe(false);
    });
  });

  describe("validateZip()", () => {
    it("accepts valid 5-digit zip", () => {
      expect(validateZip("77001")).toBe(true);
    });

    it("rejects less than 5 digits", () => {
      expect(validateZip("7700")).toBe(false);
    });

    it("rejects more than 5 digits", () => {
      expect(validateZip("770011")).toBe(false);
    });

    it("rejects non-numeric", () => {
      expect(validateZip("abcde")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateZip("")).toBe(false);
    });
  });

  describe("validatePrice()", () => {
    it("accepts positive price", () => {
      expect(validatePrice(10.5)).toBe(true);
    });

    it("rejects zero", () => {
      expect(validatePrice(0)).toBe(false);
    });

    it("rejects negative", () => {
      expect(validatePrice(-5)).toBe(false);
    });

    it("rejects NaN", () => {
      expect(validatePrice(NaN)).toBe(false);
    });

    it("rejects Infinity", () => {
      expect(validatePrice(Infinity)).toBe(false);
    });

    it("accepts $0.01 (minimum valid price)", () => {
      expect(validatePrice(0.01)).toBe(true);
    });
  });

  describe("validateQuantity()", () => {
    it("accepts positive integer", () => {
      expect(validateQuantity(5)).toBe(true);
    });

    it("rejects zero", () => {
      expect(validateQuantity(0)).toBe(false);
    });

    it("rejects negative", () => {
      expect(validateQuantity(-1)).toBe(false);
    });

    it("rejects non-integer", () => {
      expect(validateQuantity(1.5)).toBe(false);
    });

    it("rejects values over 9999", () => {
      expect(validateQuantity(10000)).toBe(false);
    });

    it("accepts max 9999", () => {
      expect(validateQuantity(9999)).toBe(true);
    });
  });

  describe("sanitizeText()", () => {
    it("trims whitespace", () => {
      expect(sanitizeText("  hello  ")).toBe("hello");
    });

    it("strips HTML tags", () => {
      expect(sanitizeText("<script>alert('xss')</script>")).toBe("alert('xss')");
    });

    it("preserves normal text", () => {
      expect(sanitizeText("Hello World")).toBe("Hello World");
    });

    it("handles empty string", () => {
      expect(sanitizeText("")).toBe("");
    });

    it("preserves emojis", () => {
      expect(sanitizeText("Hello 🙌")).toBe("Hello 🙌");
    });
  });
});
