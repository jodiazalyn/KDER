import type { Order, OrderStatus } from "@/types";
import { getListings } from "./listings-store";

const STORAGE_KEY = "kder_orders";
const SEEDED_KEY = "kder_orders_seeded";

function generateId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  seedDemoOrdersIfNeeded();
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getOrdersByStatus(status: OrderStatus | "active"): Order[] {
  const orders = getOrders();
  if (status === "active") {
    return orders
      .filter((o) => ["pending", "accepted", "ready"].includes(o.status))
      .sort((a, b) => {
        // Pending first (most urgent), sorted by auto_decline_at soonest
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return (
          new Date(a.auto_decline_at).getTime() -
          new Date(b.auto_decline_at).getTime()
        );
      });
  }
  return orders.filter((o) => o.status === status);
}

export function createOrder(
  data: Omit<Order, "id" | "terms_accepted_at" | "auto_decline_at" | "created_at" | "updated_at">
): Order {
  const orders = getOrders();
  const now = new Date();
  const autoDecline = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

  const order: Order = {
    ...data,
    id: generateId(),
    terms_accepted_at: now.toISOString(),
    auto_decline_at: autoDecline.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  orders.unshift(order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  return order;
}

export function getOrder(id: string): Order | null {
  return getOrders().find((o) => o.id === id) ?? null;
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus
): Order | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isValidTransition } = require("@/lib/order-state-machine");

  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) return null;

  const current = orders[index].status;
  if (!isValidTransition(current, status)) {
    console.error(`Invalid order transition: ${current} → ${status}`);
    return null;
  }

  orders[index] = {
    ...orders[index],
    status,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  return orders[index];
}

export function getActiveOrderCount(): number {
  return getOrders().filter((o) =>
    ["pending", "accepted", "ready"].includes(o.status)
  ).length;
}

/**
 * Auto-decline any pending orders past their auto_decline_at timestamp.
 * Returns the number of orders that were auto-declined.
 */
export function autoDeclineExpired(): number {
  const orders = getOrders();
  const now = new Date();
  let count = 0;

  for (const order of orders) {
    if (
      order.status === "pending" &&
      order.auto_decline_at &&
      new Date(order.auto_decline_at) <= now
    ) {
      updateOrderStatus(order.id, "declined");
      count++;
    }
  }

  return count;
}

function seedDemoOrdersIfNeeded() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;

  const listings = getListings();
  const now = new Date();

  const demoMembers = [
    { name: "Marcus J.", photo: null },
    { name: "Tasha R.", photo: null },
    { name: "Devon W.", photo: null },
  ];

  const orders: Order[] = [];

  // Order 1: PENDING — urgent (auto-decline in ~12 min)
  const pendingListing = listings[0];
  if (pendingListing) {
    orders.push({
      id: generateId(),
      listing_id: pendingListing.id,
      member_id: "member_demo_1",
      creator_id: "demo_creator",
      quantity: 2,
      fulfillment_type: pendingListing.fulfillment_type,
      status: "pending",
      total_amount: pendingListing.price * 2,
      platform_fee: +(pendingListing.price * 2 * 0.05).toFixed(2),
      creator_payout: +(pendingListing.price * 2 * 0.95).toFixed(2),
      notes: "Extra sauce on the side please!",
      terms_accepted_at: new Date(now.getTime() - 3 * 60000).toISOString(),
      auto_decline_at: new Date(now.getTime() + 12 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 3 * 60000).toISOString(),
      updated_at: new Date(now.getTime() - 3 * 60000).toISOString(),
      member_name: demoMembers[0].name,
      member_photo: demoMembers[0].photo,
      listing_name: pendingListing.name,
      listing_photo: pendingListing.photos[0] || null,
      delivery_address: null,
      delivery_zip: null,
      pickup_address: null,
      member_phone: null,
    });
  }

  // Order 2: ACCEPTED — ready to mark as ready
  if (pendingListing) {
    orders.push({
      id: generateId(),
      listing_id: pendingListing.id,
      member_id: "member_demo_2",
      creator_id: "demo_creator",
      quantity: 1,
      fulfillment_type: "pickup",
      status: "accepted",
      total_amount: pendingListing.price,
      platform_fee: +(pendingListing.price * 0.05).toFixed(2),
      creator_payout: +(pendingListing.price * 0.95).toFixed(2),
      notes: null,
      terms_accepted_at: new Date(now.getTime() - 30 * 60000).toISOString(),
      auto_decline_at: new Date(now.getTime() - 15 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 30 * 60000).toISOString(),
      updated_at: new Date(now.getTime() - 20 * 60000).toISOString(),
      member_name: demoMembers[1].name,
      member_photo: demoMembers[1].photo,
      listing_name: pendingListing.name,
      listing_photo: pendingListing.photos[0] || null,
      delivery_address: null,
      delivery_zip: null,
      pickup_address: null,
      member_phone: null,
    });
  }

  // Order 3: COMPLETED
  if (pendingListing) {
    orders.push({
      id: generateId(),
      listing_id: pendingListing.id,
      member_id: "member_demo_3",
      creator_id: "demo_creator",
      quantity: 3,
      fulfillment_type: "pickup",
      status: "completed",
      total_amount: pendingListing.price * 3,
      platform_fee: +(pendingListing.price * 3 * 0.05).toFixed(2),
      creator_payout: +(pendingListing.price * 3 * 0.95).toFixed(2),
      notes: "For a party of 3",
      terms_accepted_at: new Date(now.getTime() - 120 * 60000).toISOString(),
      auto_decline_at: new Date(now.getTime() - 105 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 120 * 60000).toISOString(),
      updated_at: new Date(now.getTime() - 90 * 60000).toISOString(),
      member_name: demoMembers[2].name,
      member_photo: demoMembers[2].photo,
      listing_name: pendingListing.name,
      listing_photo: pendingListing.photos[0] || null,
      delivery_address: null,
      delivery_zip: null,
      pickup_address: null,
      member_phone: null,
    });
  }

  if (orders.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }
  localStorage.setItem(SEEDED_KEY, "true");
}
