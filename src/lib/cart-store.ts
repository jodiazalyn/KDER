import type { CartItemExtra, Listing } from "@/types";

export interface CartItem {
  listing: Listing;
  quantity: number;
  /** Customer-picked add-ons for this line. Snapshotted name +
   *  price so the cart total stays stable if the creator edits the
   *  listing's `extras` while this line is pending. Empty/missing
   *  array = plate ordered without any add-ons. */
  selected_extras?: CartItemExtra[];
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
const MAX_QTY_PER_EXTRA = 99;

/** Merge a new pick of extras into an existing line's extras list.
 *  Same-name picks sum (so adding "+1 lemonade" twice yields qty 2);
 *  brand-new extras append. Caps each extra at MAX_QTY_PER_EXTRA. */
function mergeExtras(
  existing: CartItemExtra[] | undefined,
  incoming: CartItemExtra[] | undefined
): CartItemExtra[] | undefined {
  if (!incoming || incoming.length === 0) return existing;
  const out: CartItemExtra[] = existing ? existing.map((e) => ({ ...e })) : [];
  for (const inc of incoming) {
    if (!inc.name || inc.qty <= 0) continue;
    const found = out.find((e) => e.name === inc.name);
    if (found) {
      found.qty = Math.min(found.qty + inc.qty, MAX_QTY_PER_EXTRA);
      // Latest snapshot wins for price — covers the rare case where
      // the customer sees an updated price and adds again.
      found.price_cents = inc.price_cents;
    } else {
      out.push({
        name: inc.name,
        price_cents: Math.max(0, Math.floor(inc.price_cents)),
        qty: Math.min(inc.qty, MAX_QTY_PER_EXTRA),
      });
    }
  }
  return out;
}

export function addToCart(
  handle: string,
  listing: Listing,
  qty = 1,
  selectedExtras?: CartItemExtra[]
): CartItem[] {
  const cart = getCart(handle);
  const existing = cart.find((item) => item.listing.id === listing.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, MAX_QTY_PER_ITEM);
    existing.selected_extras = mergeExtras(
      existing.selected_extras,
      selectedExtras
    );
  } else {
    if (cart.length >= MAX_UNIQUE_ITEMS) return cart; // silently cap
    cart.push({
      listing,
      quantity: Math.min(qty, MAX_QTY_PER_ITEM),
      selected_extras: mergeExtras(undefined, selectedExtras),
    });
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

/** Adjust the qty of a single extra inside a cart line. qty === 0
 *  removes the extra entry from the line (but the line itself
 *  stays — to remove the plate use removeFromCart). */
export function updateCartExtraQty(
  handle: string,
  listingId: string,
  extraName: string,
  qty: number
): CartItem[] {
  const cart = getCart(handle);
  const item = cart.find((i) => i.listing.id === listingId);
  if (!item) {
    saveCart(handle, cart);
    return cart;
  }
  if (qty <= 0) {
    item.selected_extras = (item.selected_extras ?? []).filter(
      (e) => e.name !== extraName
    );
  } else {
    const existing = (item.selected_extras ?? []).find(
      (e) => e.name === extraName
    );
    if (existing) {
      existing.qty = Math.min(qty, MAX_QTY_PER_EXTRA);
    }
    // If the extra isn't on the line yet, this is a no-op — the
    // customer needs to add it from the plate detail sheet first
    // (we don't have the price_cents context here).
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

/** Sum the plate subtotal AND every selected extra across every line.
 *  Returns dollars (matches the existing API shape). */
export function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const plateTotal = item.listing.price * item.quantity;
    const extrasTotal = (item.selected_extras ?? []).reduce(
      (acc, e) => acc + (e.price_cents / 100) * e.qty,
      0
    );
    return sum + plateTotal + extrasTotal;
  }, 0);
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
