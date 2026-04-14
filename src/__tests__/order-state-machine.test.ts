import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  VALID_TRANSITIONS,
} from "@/lib/order-state-machine";

describe("Order State Machine", () => {
  describe("VALID_TRANSITIONS map", () => {
    it("should define transitions for all order statuses", () => {
      expect(VALID_TRANSITIONS).toHaveProperty("pending");
      expect(VALID_TRANSITIONS).toHaveProperty("accepted");
      expect(VALID_TRANSITIONS).toHaveProperty("ready");
      expect(VALID_TRANSITIONS).toHaveProperty("completed");
      expect(VALID_TRANSITIONS).toHaveProperty("declined");
      expect(VALID_TRANSITIONS).toHaveProperty("cancelled");
    });
  });

  describe("isValidTransition()", () => {
    // Valid forward transitions
    it("pending → accepted is valid", () => {
      expect(isValidTransition("pending", "accepted")).toBe(true);
    });

    it("pending → declined is valid", () => {
      expect(isValidTransition("pending", "declined")).toBe(true);
    });

    it("accepted → ready is valid", () => {
      expect(isValidTransition("accepted", "ready")).toBe(true);
    });

    it("accepted → declined is valid", () => {
      expect(isValidTransition("accepted", "declined")).toBe(true);
    });

    it("accepted → cancelled is valid", () => {
      expect(isValidTransition("accepted", "cancelled")).toBe(true);
    });

    it("ready → completed is valid", () => {
      expect(isValidTransition("ready", "completed")).toBe(true);
    });

    // Invalid backward transitions
    it("completed → pending is invalid", () => {
      expect(isValidTransition("completed", "pending")).toBe(false);
    });

    it("completed → accepted is invalid", () => {
      expect(isValidTransition("completed", "accepted")).toBe(false);
    });

    it("declined → accepted is invalid", () => {
      expect(isValidTransition("declined", "accepted")).toBe(false);
    });

    it("declined → pending is invalid", () => {
      expect(isValidTransition("declined", "pending")).toBe(false);
    });

    it("ready → pending is invalid", () => {
      expect(isValidTransition("ready", "pending")).toBe(false);
    });

    it("ready → declined is invalid (too late to decline)", () => {
      expect(isValidTransition("ready", "declined")).toBe(false);
    });

    // Terminal states
    it("completed has no valid transitions", () => {
      expect(isValidTransition("completed", "pending")).toBe(false);
      expect(isValidTransition("completed", "ready")).toBe(false);
    });

    it("declined has no valid transitions", () => {
      expect(isValidTransition("declined", "ready")).toBe(false);
      expect(isValidTransition("declined", "completed")).toBe(false);
    });

    it("cancelled has no valid transitions", () => {
      expect(isValidTransition("cancelled", "pending")).toBe(false);
      expect(isValidTransition("cancelled", "accepted")).toBe(false);
    });

    // Same-state transitions
    it("same status is invalid", () => {
      expect(isValidTransition("pending", "pending")).toBe(false);
      expect(isValidTransition("accepted", "accepted")).toBe(false);
    });

    // Edge cases
    it("handles unknown statuses gracefully", () => {
      expect(isValidTransition("unknown" as never, "accepted")).toBe(false);
      expect(isValidTransition("pending", "unknown" as never)).toBe(false);
    });
  });
});
