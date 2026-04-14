import { describe, it, expect, beforeEach } from "vitest";
import {
  getCart,
  addToCart,
  updateCartQty,
  removeFromCart,
  clearCart,
  getCartTotal,
  getCartCount,
} from "@/lib/cart-store";
import type { Listing } from "@/types";

const mockListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: "lst_1",
  creator_id: "c1",
  name: "Smoked Brisket",
  description: "Tasty",
  price: 25,
  quantity_available: 10,
  photo_url: null,
  category_tags: ["BBQ"],
  allergen_flags: [],
  fulfillment_types: ["pickup"],
  min_order: null,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe("Cart Store", () => {
  beforeEach(() => {
    clearCart("teststore");
  });

  it("starts with empty cart", () => {
    expect(getCart("teststore")).toEqual([]);
  });

  it("adds item to cart", () => {
    const cart = addToCart("teststore", mockListing(), 2);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it("increments quantity for existing item", () => {
    addToCart("teststore", mockListing(), 2);
    const cart = addToCart("teststore", mockListing(), 3);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(5);
  });

  it("caps quantity at 99 per item", () => {
    addToCart("teststore", mockListing(), 50);
    const cart = addToCart("teststore", mockListing(), 60);
    expect(cart[0].quantity).toBe(99);
  });

  it("caps unique items at 20", () => {
    for (let i = 0; i < 20; i++) {
      addToCart("teststore", mockListing({ id: `lst_${i}` }));
    }
    const cart = addToCart("teststore", mockListing({ id: "lst_overflow" }));
    expect(cart).toHaveLength(20);
  });

  it("updates quantity", () => {
    addToCart("teststore", mockListing(), 5);
    const cart = updateCartQty("teststore", "lst_1", 3);
    expect(cart[0].quantity).toBe(3);
  });

  it("removes item when qty set to 0", () => {
    addToCart("teststore", mockListing(), 5);
    const cart = updateCartQty("teststore", "lst_1", 0);
    expect(cart).toHaveLength(0);
  });

  it("removes item by ID", () => {
    addToCart("teststore", mockListing(), 2);
    const cart = removeFromCart("teststore", "lst_1");
    expect(cart).toHaveLength(0);
  });

  it("clears entire cart", () => {
    addToCart("teststore", mockListing(), 2);
    clearCart("teststore");
    expect(getCart("teststore")).toEqual([]);
  });

  it("calculates correct total", () => {
    const items = [
      { listing: mockListing({ price: 25 }), quantity: 2 },
      { listing: mockListing({ id: "lst_2", price: 15 }), quantity: 1 },
    ];
    expect(getCartTotal(items)).toBe(65);
  });

  it("calculates correct item count", () => {
    const items = [
      { listing: mockListing(), quantity: 3 },
      { listing: mockListing({ id: "lst_2" }), quantity: 2 },
    ];
    expect(getCartCount(items)).toBe(5);
  });

  it("isolates carts by handle", () => {
    addToCart("store_a", mockListing(), 1);
    addToCart("store_b", mockListing({ id: "lst_2" }), 3);
    expect(getCart("store_a")).toHaveLength(1);
    expect(getCart("store_b")).toHaveLength(1);
    expect(getCart("store_a")[0].quantity).toBe(1);
    expect(getCart("store_b")[0].quantity).toBe(3);
  });
});
