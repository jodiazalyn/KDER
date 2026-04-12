"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, UtensilsCrossed, MessageCircle } from "lucide-react";
import { CreatorHeader } from "@/components/storefront/CreatorHeader";
import { CategoryFilter } from "@/components/storefront/CategoryFilter";
import { PlateCard } from "@/components/storefront/PlateCard";
import { CartSheet } from "@/components/storefront/CartSheet";
import { CheckoutSheet, type OrderDetails } from "@/components/storefront/CheckoutSheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCreatorProfile, type CreatorProfile } from "@/lib/creator-store";
import { getListingsByStatus } from "@/lib/listings-store";
import { sendMessage } from "@/lib/messages-store";
import {
  getCart,
  addToCart,
  updateCartQty,
  removeFromCart,
  clearCart,
  getCartTotal,
  getCartCount,
  type CartItem,
} from "@/lib/cart-store";
import { createOrder } from "@/lib/orders-store";
import type { Listing } from "@/types";
import { toast } from "sonner";

interface StorefrontClientProps {
  handle: string;
}

export function StorefrontClient({ handle }: StorefrontClientProps) {
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // In demo mode, load from localStorage/sessionStorage
      const profile = getCreatorProfile();
      setCreator(profile);

      const active = getListingsByStatus("active");
      setListings(active);

      setCart(getCart(handle));
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [handle]);

  const handleAddToCart = useCallback(
    (listing: Listing, qty: number) => {
      const updated = addToCart(handle, listing, qty);
      setCart(updated);
      toast.success(`${listing.name} added to cart`);
    },
    [handle]
  );

  const handleUpdateQty = useCallback(
    (listingId: string, qty: number) => {
      const updated = updateCartQty(handle, listingId, qty);
      setCart(updated);
    },
    [handle]
  );

  const handleRemove = useCallback(
    (listingId: string) => {
      const updated = removeFromCart(handle, listingId);
      setCart(updated);
    },
    [handle]
  );

  const handlePlaceOrder = useCallback(
    (details: OrderDetails) => {
      // Create orders in demo store for each cart item
      for (const item of cart) {
        const totalAmount = item.listing.price * item.quantity;
        const platformFee = +(totalAmount * 0.05).toFixed(2);
        const creatorPayout = +(totalAmount - platformFee).toFixed(2);

        createOrder({
          listing_id: item.listing.id,
          member_id: `member_${Date.now()}`,
          creator_id: "demo_creator",
          quantity: item.quantity,
          fulfillment_type: details.fulfillmentType,
          status: "pending",
          total_amount: totalAmount,
          platform_fee: platformFee,
          creator_payout: creatorPayout,
          notes: details.notes || null,
          member_name: details.memberName,
          member_photo: null,
          listing_name: item.listing.name,
          listing_photo: item.listing.photos[0] || null,
        });
      }

      clearCart(handle);
      setCart([]);
    },
    [cart, handle]
  );

  // Derive categories from active listings
  const allCategories = Array.from(
    new Set(listings.flatMap((l) => l.category_tags))
  ).sort();

  // Filter listings
  const filtered = selectedCategory
    ? listings.filter((l) => l.category_tags.includes(selectedCategory))
    : listings;

  const cartTotal = getCartTotal(cart);
  const cartCount = getCartCount(cart);

  if (!loaded) return null;

  if (!creator) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4">
        <h1 className="text-2xl font-bold text-white">Store not found</h1>
        <p className="mt-2 text-white/50">This creator doesn&apos;t exist.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] pb-24">
      {/* Creator header */}
      <CreatorHeader creator={creator} />

      {/* Storefront paused banner */}
      {!creator.storefront_active && (
        <div className="mx-4 mt-4 rounded-2xl border border-orange-400/20 bg-orange-900/20 p-3 text-center">
          <p className="text-sm text-orange-300">
            This storefront is currently paused.
          </p>
        </div>
      )}

      {/* Message Creator button */}
      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={() => setMessageOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] text-sm font-medium text-white/70 hover:bg-white/[0.10] active:scale-95 transition-all"
        >
          <MessageCircle size={16} />
          Message {creator.display_name}
        </button>
      </div>

      {/* Category filter */}
      {allCategories.length > 0 && (
        <div className="mt-4">
          <CategoryFilter
            categories={allCategories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      )}

      {/* Plates grid */}
      <div className="mt-4 px-4">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((listing) => {
              const inCart = cart.find((c) => c.listing.id === listing.id);
              return (
                <PlateCard
                  key={listing.id}
                  listing={listing}
                  cartQty={inCart?.quantity ?? 0}
                  onAddToCart={handleAddToCart}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 pt-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <UtensilsCrossed size={28} className="text-white/20" />
            </div>
            <p className="text-center text-sm text-white/50">
              {selectedCategory
                ? `No ${selectedCategory} plates available right now.`
                : "No plates available right now. Check back soon!"}
            </p>
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-4 right-4 z-40 mx-auto flex h-14 max-w-lg items-center justify-center gap-2 rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_24px_rgba(27,94,32,0.6)] active:scale-95 transition-transform"
        >
          <ShoppingCart size={18} />
          View Cart ({cartCount} {cartCount === 1 ? "item" : "items"}) ·{" "}
          ${cartTotal.toFixed(2)}
        </button>
      )}

      {/* Cart sheet */}
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cart}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      {/* Checkout sheet */}
      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart}
        creatorHandle={handle}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* Message Creator sheet */}
      <Sheet open={messageOpen} onOpenChange={setMessageOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
        >
          <SheetHeader>
            <SheetTitle className="text-white">
              Message {creator.display_name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Ask ${creator.display_name} a question...`}
              rows={3}
              className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-400/60 focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!messageText.trim()) return;
                const memberId = `member_${Date.now()}`;
                sendMessage(memberId, "demo_creator", messageText.trim());
                toast.success("Message sent to " + creator.display_name);
                setMessageText("");
                setMessageOpen(false);
              }}
              disabled={!messageText.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1B5E20] text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform disabled:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle size={16} />
              Send Message
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
