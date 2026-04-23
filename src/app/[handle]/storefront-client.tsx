"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Grid3x3, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { CreatorHeader } from "@/components/storefront/CreatorHeader";
import { PlateTile } from "@/components/storefront/PlateTile";
import { PlateDetailSheet } from "@/components/storefront/PlateDetailSheet";
import { CartSheet } from "@/components/storefront/CartSheet";
import { CheckoutSheet, type OrderDetails } from "@/components/storefront/CheckoutSheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type CreatorProfile } from "@/lib/creator-store";
import { createClient } from "@/lib/supabase/client";
import { Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCart,
  addToCart,
  updateCartQty,
  removeFromCart,
  getCartTotal,
  getCartCount,
  type CartItem,
} from "@/lib/cart-store";
import type { Listing, Message } from "@/types";
import { toast } from "sonner";

interface StorefrontClientProps {
  handle: string;
  initialCreator: CreatorProfile | null;
  initialListings: Listing[];
}

export function StorefrontClient({
  handle,
  initialCreator,
  initialListings,
}: StorefrontClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creator] = useState<CreatorProfile | null>(initialCreator);
  const [listings] = useState<Listing[]>(initialListings);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPlate, setSelectedPlate] = useState<Listing | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Resolve current auth user on mount so the Message/Checkout buttons
  // can gate unauthenticated customers into the signup flow.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Hydrate cart from sessionStorage on mount (client-only state)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCart(getCart(handle));
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

  const handlePlaceOrder = useCallback((_details: OrderDetails) => {
    // Intentionally a no-op. Order rows are created server-side by
    // POST /api/v1/checkout BEFORE redirecting to Stripe. The previous
    // implementation also wrote a duplicate demo order to localStorage via
    // createOrder() from orders-store; that was redundant with the real
    // Supabase insert and is removed here.
    //
    // We also intentionally do NOT clear the cart here. The cart must persist
    // until Stripe confirms payment — otherwise a customer who taps back on
    // the Stripe page loses everything they added. The cart is cleared on
    // the /order-confirmation page after successful payment.
  }, []);

  // Auto-open cart / message sheet on ?action=<checkout|message> after signup redirect
  useEffect(() => {
    const action = searchParams.get("action") || sessionStorage.getItem("kder_signup_action");
    if (!action || !currentUserId) return;

    if (action === "message") {
      setMessageOpen(true);
    } else if (action === "checkout") {
      setCartOpen(true);
    }
    // Consume the hint so reloads don't re-open.
    sessionStorage.removeItem("kder_signup_action");
    if (searchParams.get("action")) {
      router.replace(`/@${handle}`);
    }
  }, [currentUserId, searchParams, router, handle]);

  // Load chat messages + subscribe to realtime when the message sheet opens.
  useEffect(() => {
    if (!messageOpen || !currentUserId || !creator?.member_id) return;
    const partnerId = creator.member_id;

    const markRead = () => {
      // Fire-and-forget. The RLS "Recipient can mark read" policy scopes this
      // to our incoming rows from partnerId in the general (order_id IS NULL) thread.
      fetch("/api/v1/messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, order_id: null }),
      }).catch(() => {
        /* best-effort; Realtime UPDATE will re-sync on next open if this fails */
      });
    };

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${currentUserId})`
        )
        .is("order_id", null)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setChatMessages((data as Message[]) ?? []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      // Mark any unread incoming messages from this partner as read now that
      // the sheet is visible and the user can see them.
      markRead();
    })();

    const channel = supabase
      .channel(`storefront-chat-${currentUserId}-${partnerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const m = payload.new as Message;
          const involvesMe =
            (m.sender_id === currentUserId && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === currentUserId);
          if (!involvesMe || m.order_id) return;
          setChatMessages((prev) => {
            // Skip if we already have this real id.
            if (prev.some((p) => p.id === m.id)) return prev;
            // Reconcile: if an optimistic row matches (same sender, body, and
            // was created within 10s), replace it with the real row so the
            // temporary opt-* id doesn't linger.
            const optIdx = prev.findIndex(
              (p) =>
                p.id.startsWith("opt-") &&
                p.sender_id === m.sender_id &&
                p.recipient_id === m.recipient_id &&
                p.body === m.body &&
                Math.abs(
                  new Date(p.created_at).getTime() -
                    new Date(m.created_at).getTime()
                ) < 10_000
            );
            if (optIdx !== -1) {
              const next = prev.slice();
              next[optIdx] = m;
              return next;
            }
            return [...prev, m];
          });
          // If the incoming message is from the partner (not our own echo),
          // mark it read immediately — the sheet is open and visible.
          if (m.sender_id === partnerId) markRead();
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const m = payload.new as Message;
          const involvesMe =
            (m.sender_id === currentUserId && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === currentUserId);
          if (!involvesMe || m.order_id) return;
          // Merge server-updated fields (typically read_at) into the matching
          // message so the sender's UI flips from "Pending" to "✓ Read".
          setChatMessages((prev) =>
            prev.map((p) => (p.id === m.id ? { ...p, ...m } : p))
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [messageOpen, currentUserId, creator?.member_id, supabase]);

  const handleMessageClick = useCallback(() => {
    if (!currentUserId) {
      router.push(
        `/signup?mode=customer&next=${encodeURIComponent("/@" + handle)}&action=message`
      );
      return;
    }
    setMessageOpen(true);
  }, [currentUserId, router, handle]);

  const handleSendMessage = useCallback(async () => {
    const body = messageText.trim();
    if (!body || sending || !currentUserId || !creator?.member_id) return;
    setSending(true);

    // Optimistic insert — render the message immediately so the user sees
    // their send confirmed. The opt-* id will be reconciled when the server
    // responds (or when Realtime echoes the insert, whichever wins the race).
    const optimisticId = `opt-${Date.now()}`;
    const partnerId = creator.member_id;
    const optimistic: Message = {
      id: optimisticId,
      order_id: null,
      sender_id: currentUserId,
      recipient_id: partnerId,
      body,
      media_url: null,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimistic]);
    setMessageText("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: partnerId,
          body,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Couldn't send message. Try again.");
        setChatMessages((prev) => prev.filter((p) => p.id !== optimisticId));
        setMessageText(body);
        return;
      }
      // Swap the optimistic row with the real server row as soon as it's back.
      const serverMsg: Message | undefined = json?.data?.message;
      if (serverMsg) {
        setChatMessages((prev) => {
          // If Realtime already reconciled it, don't re-add.
          if (prev.some((p) => p.id === serverMsg.id)) {
            return prev.filter((p) => p.id !== optimisticId);
          }
          return prev.map((p) => (p.id === optimisticId ? serverMsg : p));
        });
      }
    } catch {
      toast.error("Couldn't send message. Check your connection.");
      setChatMessages((prev) => prev.filter((p) => p.id !== optimisticId));
      setMessageText(body);
    } finally {
      setSending(false);
    }
  }, [messageText, sending, currentUserId, creator?.member_id]);

  const cartTotal = getCartTotal(cart);
  const cartCount = getCartCount(cart);

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
      <div className="mx-auto max-w-[640px]">
        {/* Instagram-style profile header (avatar + stats row + CTAs) */}
        <CreatorHeader creator={creator} onMessageClick={handleMessageClick} />

        {/* Storefront paused banner */}
        {!creator.storefront_active && (
          <div className="mx-4 mb-4 rounded-2xl border border-orange-400/20 bg-orange-900/20 p-3 text-center">
            <p className="text-sm text-orange-300">
              This storefront is currently paused.
            </p>
          </div>
        )}

        {/* Grid-icon tab bar — visual-only for now, single content type */}
        <div className="flex items-center justify-center gap-2 border-y border-white/[0.08] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          <Grid3x3 size={14} />
          Plates
        </div>

        {/* 3-column square grid of plate tiles with 2px gutter */}
        {listings.length > 0 ? (
          <div className="grid grid-cols-3 gap-[2px]">
            {listings.map((listing) => (
              <PlateTile
                key={listing.id}
                listing={listing}
                onClick={setSelectedPlate}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 pt-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <UtensilsCrossed size={28} className="text-white/20" />
            </div>
            <p className="text-center text-sm text-white/50">
              No plates available right now. Check back soon!
            </p>
          </div>
        )}
      </div>

      {/* Plate detail sheet — opens when a tile is tapped */}
      <PlateDetailSheet
        listing={selectedPlate}
        open={selectedPlate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlate(null);
        }}
        cartQty={
          selectedPlate
            ? cart.find((c) => c.listing.id === selectedPlate.id)?.quantity ?? 0
            : 0
        }
        onAddToCart={handleAddToCart}
      />

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
          if (!currentUserId) {
            // Gate unauthenticated checkout — redirect to signup, come back
            // with action=checkout so the cart auto-opens after verify.
            router.push(
              `/signup?mode=customer&next=${encodeURIComponent("/@" + handle)}&action=checkout`
            );
            return;
          }
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
        creatorName={creator.display_name}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* Message Creator sheet — full chat thread */}
      <Sheet open={messageOpen} onOpenChange={setMessageOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-h-[80vh] flex flex-col"
        >
          <SheetHeader>
            <SheetTitle className="text-white">
              Message {creator.display_name}
            </SheetTitle>
          </SheetHeader>

          {/* Chat history */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 min-h-[120px] max-h-[45vh] px-1">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-white/30 py-8">
                No messages yet. Say hello to {creator.display_name}!
              </p>
            ) : (
              chatMessages.map((msg) => {
                const isMine = msg.sender_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", isMine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
                        isMine
                          ? "bg-green-900/[0.40] border border-green-400/[0.25] text-white"
                          : "bg-white/[0.06] border border-white/[0.12] text-white/90"
                      )}
                    >
                      <p>{msg.body}</p>
                      <div className={cn(
                        "mt-1 flex items-center gap-1 text-[10px]",
                        isMine ? "text-green-300/50 justify-end" : "text-white/30"
                      )}>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMine && !msg.read_at && (
                          <span className="flex items-center gap-0.5 text-orange-300/60">
                            <Clock size={9} />
                            Pending
                          </span>
                        )}
                        {isMine && msg.read_at && (
                          <span className="text-green-400/60">✓ Read</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="mt-3 flex items-center gap-2 pb-4">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message ${creator.display_name}...`}
              disabled={sending}
              className="h-11 flex-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/35 focus:border-green-400/60 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
                messageText.trim() && !sending
                  ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.4)]"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              <Send size={18} />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
