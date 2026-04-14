import type { OrderStatus } from "@/types";

/**
 * Valid order status transitions.
 * Terminal states (completed, declined, cancelled) have no outgoing transitions.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "declined"],
  accepted: ["ready", "declined", "cancelled"],
  ready: ["completed"],
  completed: [],
  declined: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Attempt a status transition. Throws if invalid.
 */
export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid order transition: ${from} → ${to}. Allowed: ${VALID_TRANSITIONS[from]?.join(", ") || "none"}`
    );
  }
}
