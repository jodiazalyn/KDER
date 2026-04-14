import type { Listing } from "@/types";

export interface CartItem {
  listing: Listing;
  quantity: number;
}

function cartKey(handle: string): string {
  return `kder_cart_${handle}`;
}

export function getCart(handle: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(cartKey(handle));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(handle: string, items: CartItem[]) {
  sessionStorage.setItem(cartKey(handle), JSON.stringify(items));
}

const MAX_UNIQUE_ITEMS = 20;
const MAX_QTY_PER_ITEM = 99;

export function addToCart(handle: string, listing: Listing, qty = 1): CartItem[] {
  const cart = getCart(handle);
  const existing = cart.find((item) => item.listing.id === listing.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, MAX_QTY_PER_ITEM);
  } else {
    if (cart.length >= MAX_UNIQUE_ITEMS) return cart; // silently cap
    cart.push({ listing, quantity: Math.min(qty, MAX_QTY_PER_ITEM) });
  }

  saveCart(handle, cart);
  return cart;
}

export function updateCartQty(handle: string, listingId: string, qty: number): CartItem[] {
  let cart = getCart(handle);
  if (qty <= 0) {
    cart = cart.filter((item) => item.listing.id !== listingId);
  } else {
    const item = cart.find((item) => item.listing.id === listingId);
    if (item) item.quantity = Math.min(qty, MAX_QTY_PER_ITEM);
  }
  saveCart(handle, cart);
  return cart;
}

export function removeFromCart(handle: string, listingId: string): CartItem[] {
  const cart = getCart(handle).filter((item) => item.listing.id !== listingId);
  saveCart(handle, cart);
  return cart;
}

export function clearCart(handle: string): void {
  sessionStorage.removeItem(cartKey(handle));
}

export function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.listing.price * item.quantity, 0);
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
