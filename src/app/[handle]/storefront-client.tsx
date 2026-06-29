"use client";

import { useState, useEffect, useCallback, useRef, useId, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ShoppingCart, UtensilsCrossed, Sparkles } from "lucide-react";
import { CategoryFilter } from "@/components/storefront/CategoryFilter";
import { CreatorReviews } from "@/components/storefront/CreatorReviews";
import {
  ActiveOrderBanner,
  type ActiveOrderSummary,
} from "@/components/storefront/ActiveOrderBanner";
import { CreatorHeader } from "@/components/storefront/CreatorHeader";
import { PlateTile } from "@/components/storefront/PlateTile";
import { CateringMenuCard } from "@/components/storefront/CateringMenuCard";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";
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
  updateCartExtraQty,
  removeFromCart,
  getCartTotal,
  getCartCount,
  type CartItem,
} from "@/lib/cart-store";
import type { CartItemExtra, Listing, Message } from "@/types";
import { toast } from "sonner";

// Defer the three heavy sheets to async chunks. ~70% of buyer visits to a
// storefront never open any of them, and even those who do can wait an
// extra ~100ms while the chunk fetches on the way to opening the sheet.
const PlateDetailSheet = dynamic(
  () =>
    import("@/components/storefront/PlateDetailSheet").then(
      (m) => m.PlateDetailSheet
    ),
  { ssr: false }
);
const CartSheet = dynamic(
  () => import("@/components/storefront/CartSheet").then((m) => m.CartSheet),
  { ssr: false }
);
// Drive Thru — the flagship voice/photo food concierge. Lazy: the voice +
// streaming machinery only loads once a visitor actually opens it.
const ConciergeSheet = dynamic(
  () =>
    import("@/components/storefront/ConciergeSheet").then(
      (m) => m.ConciergeSheet
    ),
  { ssr: false }
);
type ConciergePlateCardT =
  import("@/lib/concierge/concierge-tools").ConciergePlateCard;
type CheckoutSheetOrderDetails =
  import("@/components/storefront/CheckoutSheet").OrderDetails;
const CheckoutSheet = dynamic(
  () =>
    import("@/components/storefront/CheckoutSheet").then(
      (m) => m.CheckoutSheet
    ),
  { ssr: false }
);

interface StorefrontClientProps {
  handle: string;
  initialCreator: CreatorProfile | null;
  initialListings: Listing[];
  /** Resolved server-side from the Supabase session — saves a client-side
   *  round-trip to determine whether to gate Message/Checkout into signup. */
  initialUserId: string | null;
  /** Visitor's most-recent in-flight order with this creator (or null).
   *  When set, an ActiveOrderBanner renders above the storefront header
   *  so the customer can hop back to /order-confirmation without using
   *  browser back. */
  initialActiveOrder: ActiveOrderSummary | null;
}

export function StorefrontClient({
  handle,
  initialCreator,
  initialListings,
  initialUserId,
  initialActiveOrder,
}: StorefrontClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creator] = useState<CreatorProfile | null>(initialCreator);
  const [listings] = useState<Listing[]>(initialListings);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // Active storefront tab. Plates + Reviews are always present; Catering
  // only appears when the creator has ≥1 catering listing.
  const [activeTab, setActiveTab] = useState<
    "plates" | "catering" | "reviews"
  >("plates");
  // IDs of catering listings the customer has tapped to pre-select.
  // These ride along to the inquiry form so the creator's quote starts
  // pre-populated with the items the customer wants.
  const [selectedCateringIds, setSelectedCateringIds] = useState<Set<string>>(
    new Set()
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPlate, setSelectedPlate] = useState<Listing | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  // Track first-interaction with each lazily-loaded sheet so the dynamic
  // chunks stay out of the critical path until a user actually engages.
  const [hasOpenedCart, setHasOpenedCart] = useState(false);
  const [hasOpenedCheckout, setHasOpenedCheckout] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  // Seeded from the server (no extra client round-trip); refreshes via
  // onAuthStateChange in case the customer signs in mid-session.
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId);
  const [sending, setSending] = useState(false);
  // Anon-auth gate state — same shape as CheckoutSheet's guest fields.
  // Used only when a non-authed visitor opens the message sheet.
  const [gateName, setGateName] = useState("");
  const [gatePhoneRaw, setGatePhoneRaw] = useState("");
  const gatePhoneDigits = gatePhoneRaw.replace(/\D/g, "");
  const gateValid =
    gateName.trim().length > 0 && gatePhoneDigits.length === 10;
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  // Unique per-mount suffix for the Realtime channel name. Without this,
  // Strict Mode's double-invoke + supabase's by-name channel registry can
  // leave a stale subscribed channel that the next mount picks up,
  // causing `.on()`-after-`.subscribe()` crashes.
  const instanceId = useId();

  // Coachmark anchor for the first plate tile — first-time visitors
  // get a tip explaining that tapping a tile opens details.
  const firstTileRef = useRef<HTMLDivElement>(null);
  // Coachmark anchor for the CATERING tab — fires once the first time
  // a visitor lands on a creator that has catering listings.
  const cateringTabRef = useRef<HTMLButtonElement>(null);
  // Scroll target for the "Start order" action in the redesigned header.
  // Tapping Start order activates the Menu tab and brings the (sticky) tab
  // strip to the top of the viewport so the plate list is immediately in view.
  const tabStripRef = useRef<HTMLDivElement>(null);
  const handleStartOrder = useCallback(() => {
    setActiveTab("plates");
    requestAnimationFrame(() => {
      tabStripRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // Bridge a Drive Thru concierge pick into a creator's EXISTING order flow.
  // The concierge searches the whole marketplace, so a pick may belong to this
  // creator (open the plate sheet inline) or another (navigate to their
  // storefront with ?plate=<id> so the same sheet opens there). We never build
  // a mixed cart — each order still pays out to exactly one creator.
  const handlePickConciergePlate = useCallback(
    (plate: ConciergePlateCardT) => {
      const pickedHandle = (plate.creator.handle ?? "")
        .replace(/^@/, "")
        .toLowerCase();
      const isThisCreator = pickedHandle === handle.toLowerCase();
      if (isThisCreator) {
        const listing = listings.find((l) => l.id === plate.id);
        if (listing) {
          setConciergeOpen(false);
          setActiveTab("plates");
          setSelectedPlate(listing);
          return;
        }
      }
      // Different creator (or not in this page's listings): hand off to that
      // storefront and deep-link straight to the plate.
      if (pickedHandle) {
        setConciergeOpen(false);
        router.push(`/@${pickedHandle}?plate=${encodeURIComponent(plate.id)}`);
      }
    },
    [handle, listings, router]
  );

  // Consume a `?plate=<id>` deep-link (e.g. arriving from a concierge pick on
  // another storefront): open that plate's detail sheet, then strip the param
  // so a reload doesn't reopen it.
  useEffect(() => {
    const plateId = searchParams.get("plate");
    if (!plateId) return;
    const listing = listings.find((l) => l.id === plateId);
    if (listing) {
      setActiveTab("plates");
      setSelectedPlate(listing);
    }
    router.replace(`/@${handle}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, listings]);

  // Subscribe to auth changes so signup-while-on-storefront propagates
  // (e.g. customer taps "Buy now" → auth flow → returns to this page).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Hydrate cart from sessionStorage on mount (client-only state)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCart(getCart(handle));
    });
    return () => cancelAnimationFrame(frame);
  }, [handle]);

  const handleAddToCart = useCallback(
    (listing: Listing, qty: number, selectedExtras?: CartItemExtra[]) => {
      const updated = addToCart(handle, listing, qty, selectedExtras);
      setCart(updated);
      toast.success(`${listing.name} added to cart`);
    },
    [handle]
  );

  const handleBuyNow = useCallback(
    (listing: Listing, qty: number, selectedExtras?: CartItemExtra[]) => {
      // Single code path regardless of auth state. The CheckoutSheet
      // itself handles the no-auth case inline: it shows name+phone
      // inputs and calls /api/v1/auth/anon-customer to register an
      // anonymous Supabase session before hitting Stripe.
      // (Twilio A2P 10DLC pending — OTP is removed from the customer
      // purchase path during the registration window. See
      // /api/v1/auth/anon-customer for the temporary auth bridge.)
      const updated = addToCart(handle, listing, qty, selectedExtras);
      setCart(updated);
      setSelectedPlate(null);
      setHasOpenedCheckout(true);
      setCheckoutOpen(true);
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

  const handleUpdateExtraQty = useCallback(
    (listingId: string, extraName: string, qty: number) => {
      const updated = updateCartExtraQty(handle, listingId, extraName, qty);
      setCart(updated);
    },
    [handle]
  );

  const handlePlaceOrder = useCallback((_details: CheckoutSheetOrderDetails) => {
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
      setHasOpenedCart(true);
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
      // Load the unified conversation between this member and creator
      // regardless of order_id. Same thread renders here AND on the order
      // page so a message sent from either surface appears in both.
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setChatMessages((data as Message[]) ?? []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      // Mark any unread incoming messages from this partner as read now that
      // the sheet is visible and the user can see them.
      markRead();
    })();

    const channel = supabase
      .channel(
        `storefront-chat-${currentUserId}-${partnerId}-${instanceId}`
      )
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
          if (!involvesMe) return;
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
          if (!involvesMe) return;
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
  }, [messageOpen, currentUserId, creator?.member_id, supabase, instanceId]);

  // Always opens the sheet. When the visitor has no auth session, the
  // sheet renders an inline name+phone gate (same anon-auth bridge as
  // CheckoutSheet — see /api/v1/auth/anon-customer) instead of bouncing
  // to the full /signup flow. Once anon-auth succeeds, currentUserId
  // updates and the sheet swaps to the chat thread.
  const handleMessageClick = useCallback(() => {
    setMessageOpen(true);
  }, []);

  // Anon-auth bridge: register an anonymous Supabase session keyed to
  // the typed name+phone so messages can write `sender_id = auth.uid()`.
  // Mirrors CheckoutSheet's pre-checkout flow. Server cookie-sets the
  // session; we also setCurrentUserId from the response so the sheet
  // flips to chat without a round-trip.
  const handleAnonAuthForMessaging = useCallback(async () => {
    if (!gateValid || gateSubmitting) return;
    setGateSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/anon-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: gateName.trim(),
          phone: gatePhoneDigits,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code =
          typeof json?.code === "string" ? ` [${json.code}]` : "";
        toast.error(
          `${json?.error || "Couldn't start chat. Try again."}${code}`
        );
        setGateSubmitting(false);
        return;
      }
      const userId = json?.data?.user_id as string | undefined;
      if (!userId) {
        toast.error("Couldn't start chat. Try again.");
        setGateSubmitting(false);
        return;
      }
      setCurrentUserId(userId);
      setGateName("");
      setGatePhoneRaw("");
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setGateSubmitting(false);
    }
  }, [gateValid, gateSubmitting, gateName, gatePhoneDigits]);

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

  // Split listings by kind. Catering uses a different flow (inquiry →
  // quote → deposit), so the storefront renders them in separate tabs.
  const plateListings = useMemo(
    () => listings.filter((l) => l.kind !== "catering"),
    [listings]
  );
  const cateringListings = useMemo(
    () => listings.filter((l) => l.kind === "catering"),
    [listings]
  );

  // Tab strip config. Plates + Reviews are always shown; Catering is
  // inserted between them only when the creator offers catering. Each tab
  // carries a small count sublabel (redesign): plate count, catering
  // entry price, and the review rating · count.
  const storefrontTabs = useMemo(() => {
    const plateCount = plateListings.length;
    const minCateringPrice =
      cateringListings.length > 0
        ? Math.min(...cateringListings.map((l) => l.price))
        : null;
    const reviewSub =
      creator?.review_count && creator.review_count > 0 && creator.review_rating_avg != null
        ? `${creator.review_rating_avg.toFixed(1)} · ${creator.review_count}`
        : "New";
    return [
      {
        key: "plates" as const,
        label: "Menu",
        count: `${plateCount} ${plateCount === 1 ? "plate" : "plates"}`,
      },
      ...(cateringListings.length > 0
        ? [
            {
              key: "catering" as const,
              label: "Catering",
              count:
                minCateringPrice != null
                  ? `From $${
                      Number.isInteger(minCateringPrice)
                        ? minCateringPrice
                        : minCateringPrice.toFixed(2)
                    }`
                  : "",
            },
          ]
        : []),
      {
        key: "reviews" as const,
        label: "Reviews",
        count: reviewSub,
      },
    ];
  }, [
    plateListings.length,
    cateringListings,
    creator?.review_count,
    creator?.review_rating_avg,
  ]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    // Tag filter only applies to plates; catering tab has its own layout.
    plateListings.forEach((l) => l.category_tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [plateListings]);

  const filteredListings = useMemo(
    () =>
      selectedTag
        ? plateListings.filter((l) => l.category_tags.includes(selectedTag))
        : plateListings,
    [plateListings, selectedTag]
  );

  const toggleCateringSelection = useCallback((listingId: string) => {
    setSelectedCateringIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }, []);

  const cartTotal = getCartTotal(cart);
  const cartCount = getCartCount(cart);

  // A floating action bar is pinned to the bottom only in two cases: the
  // Plates tab with a non-empty cart, or the Catering tab with ≥1 selection.
  // We reserve bottom padding to clear that bar ONLY when it's actually
  // showing — otherwise the page would carry ~7rem of dead whitespace under
  // every short screen (Reviews, empty states, etc.).
  const hasFloatingBar =
    (activeTab === "plates" && cartCount > 0) ||
    (activeTab === "catering" && selectedCateringIds.size > 0);

  if (!creator) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <h1 className="text-2xl font-bold text-foreground">Store not found</h1>
        <p className="mt-2 text-muted-foreground">This creator doesn&apos;t exist.</p>
      </main>
    );
  }

  return (
    <main
      className={`min-h-[100dvh] bg-background ${
        hasFloatingBar
          ? "pb-[calc(7rem+env(safe-area-inset-bottom))]"
          : "pb-[calc(2rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <div className="mx-auto max-w-[640px]">
        {/* Active-order CTA — only when the visitor has an in-flight order
            with this creator. Inbound link to their order page that
            otherwise didn't exist anywhere on the storefront. */}
        {initialActiveOrder && (
          <div className="mx-4 mt-4">
            <ActiveOrderBanner order={initialActiveOrder} />
          </div>
        )}

        {/* Redesigned storefront header (cover + floating profile + stats +
            Start order / Message actions). */}
        <CreatorHeader
          creator={creator}
          onMessageClick={handleMessageClick}
          onStartOrder={handleStartOrder}
        />

        {/* Drive Thru nudge — the flagship concierge, surfaced on EVERY
            storefront. Lets a visitor describe / show what they want and
            order from across the whole marketplace, not just this kitchen. */}
        <button
          type="button"
          onClick={() => setConciergeOpen(true)}
          className="group mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/[0.04] px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] text-white">
            <Sparkles size={20} strokeWidth={2.3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              Ask Drive Thru
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Tell me what you&apos;re craving — I&apos;ll find it across KDER.
            </span>
          </span>
          <span className="flex-shrink-0 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-bold text-foreground">
            Tap to talk
          </span>
        </button>

        {/* Storefront paused banner */}
        {!creator.storefront_active && (
          <div className="glass-card mx-4 mb-4 border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <p className="text-sm text-amber-600 dark:text-amber-300">
              This storefront is currently paused.
            </p>
          </div>
        )}

        {/* Tab bar — Plates | [Catering] | Reviews. Plates and Reviews
            are always present; Catering only appears when the creator
            has ≥1 catering listing. */}
        <div
          ref={tabStripRef}
          role="tablist"
          aria-label="Storefront sections"
          className="sticky top-0 z-10 flex gap-1.5 border-b border-border bg-background/85 px-3.5 py-3 backdrop-blur-md"
        >
          {storefrontTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                ref={tab.key === "catering" ? cateringTabRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      isActive ? "text-primary" : "text-muted-foreground/70"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Two-tier category filter — only on the Plates tab */}
        {activeTab === "plates" && availableTags.length > 0 && (
          <CategoryFilter
            availableTags={availableTags}
            selected={selectedTag}
            onSelect={setSelectedTag}
          />
        )}

        {/* Catering tab content — wide cards in a single column */}
        {activeTab === "catering" && (
          <div className="space-y-2 px-4 py-4">
            {cateringListings.length > 0 ? (
              cateringListings.map((listing) => (
                <CateringMenuCard
                  key={listing.id}
                  listing={listing}
                  selected={selectedCateringIds.has(listing.id)}
                  onToggle={toggleCateringSelection}
                />
              ))
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No catering options right now.
              </p>
            )}
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Tap items you&apos;re interested in, then request a quote.
            </p>
          </div>
        )}

        {/* Reviews tab content — ratings + written reviews. Self-fetches
            on first render via CreatorReviews. */}
        {activeTab === "reviews" && (
          <CreatorReviews
            creatorId={creator.creator_id ?? null}
            averageRating={creator.review_rating_avg}
            reviewCount={creator.review_count}
          />
        )}

        {/* Plates grid + empty state — only on the Plates tab */}
        {activeTab === "plates" && (
          filteredListings.length > 0 ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {filteredListings.map((listing, idx) => (
                <div
                  key={listing.id}
                  ref={idx === 0 ? firstTileRef : undefined}
                >
                  <PlateTile
                    listing={listing}
                    onClick={setSelectedPlate}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 pt-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <UtensilsCrossed size={28} className="text-muted-foreground/40" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {selectedTag
                  ? `No plates tagged "${selectedTag}" right now.`
                  : "No plates available right now. Check back soon!"}
              </p>
            </div>
          )
        )}
      </div>

      {/* Plate detail sheet — only mounted once the user actually taps a
          tile so the dynamic chunk doesn't fetch on initial render. */}
      {selectedPlate !== null && (
        <PlateDetailSheet
          listing={selectedPlate}
          open={selectedPlate !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPlate(null);
          }}
          cartQty={
            cart.find((c) => c.listing.id === selectedPlate.id)?.quantity ?? 0
          }
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          creator={{
            display_name: creator.display_name,
            handle: creator.handle,
            photo_url: creator.photo_url,
          }}
        />
      )}

      {/* Floating cart button — only on the Plates tab */}
      {activeTab === "plates" && cartCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setHasOpenedCart(true);
            setCartOpen(true);
          }}
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto flex h-14 max-w-lg items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
        >
          <ShoppingCart size={18} />
          View Cart ({cartCount} {cartCount === 1 ? "item" : "items"}) ·{" "}
          ${cartTotal.toFixed(2)}
        </button>
      )}

      {/* Floating Request Catering button — only on the Catering tab,
          and only once the customer has selected at least one item.
          Passes the selected ids to the inquiry form via query string. */}
      {activeTab === "catering" && selectedCateringIds.size > 0 && (
        <button
          type="button"
          onClick={() => {
            const ids = Array.from(selectedCateringIds).join(",");
            router.push(
              `/${encodeURIComponent(handle)}/catering/inquire?items=${ids}`
            );
          }}
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto flex h-14 max-w-lg items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
        >
          <CalendarRange size={18} />
          Request Catering ({selectedCateringIds.size}{" "}
          {selectedCateringIds.size === 1 ? "item" : "items"})
        </button>
      )}

      {/* Cart sheet — chunk fetches lazily on first open. Stays mounted
          after first open so reopening is instant. */}
      {hasOpenedCart && (
        <CartSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={cart}
          onUpdateQty={handleUpdateQty}
          onRemove={handleRemove}
          onUpdateExtraQty={handleUpdateExtraQty}
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
            setHasOpenedCheckout(true);
            setCheckoutOpen(true);
          }}
        />
      )}

      {/* Checkout sheet — same lazy-mount pattern. */}
      {hasOpenedCheckout && (
        <CheckoutSheet
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          items={cart}
          creatorHandle={handle}
          creatorName={creator.display_name}
          onPlaceOrder={handlePlaceOrder}
        />
      )}

      {/* Message Creator sheet — full chat thread */}
      <Sheet open={messageOpen} onOpenChange={setMessageOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border text-foreground max-h-[80vh] flex flex-col"
        >
          <SheetHeader>
            <SheetTitle className="text-foreground">
              Message {creator.display_name}
            </SheetTitle>
          </SheetHeader>

          {!currentUserId ? (
            /* Anon-auth gate — same friction as the checkout name/phone
               step. Once submitted, the sheet swaps to the chat thread. */
            <div className="mt-4 space-y-4 pb-6">
              <p className="text-sm text-muted-foreground">
                Tell {creator.display_name} who you are. Your name + phone
                lets them reach back if they need to confirm details about
                your message.
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="glass-input h-12 w-full px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                  aria-label="Your name"
                />
                <input
                  type="tel"
                  value={gatePhoneRaw}
                  onChange={(e) => setGatePhoneRaw(e.target.value)}
                  placeholder="Phone number"
                  autoComplete="tel"
                  inputMode="tel"
                  className="glass-input h-12 w-full px-4 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                  aria-label="Phone number"
                />
                <p className="text-[11px] text-muted-foreground">
                  We won&apos;t text you anything you didn&apos;t ask for.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnonAuthForMessaging}
                disabled={!gateValid || gateSubmitting}
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-full text-sm font-bold transition-all active:scale-95",
                  gateValid && !gateSubmitting
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
                    : "glass-btn-pill text-muted-foreground cursor-not-allowed"
                )}
              >
                {gateSubmitting
                  ? "Starting chat…"
                  : `Start chat with ${creator.display_name}`}
              </button>
            </div>
          ) : (
            <>
          {/* Chat history */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 min-h-[120px] max-h-[45vh] px-1">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
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
                          ? "border border-primary/30 bg-primary/15 text-foreground backdrop-blur-[24px] backdrop-saturate-[200%]"
                          : "glass-card !rounded-2xl text-foreground"
                      )}
                    >
                      <p>{msg.body}</p>
                      <div className={cn(
                        "mt-1 flex items-center gap-1 text-[10px]",
                        isMine ? "text-primary/70 justify-end" : "text-muted-foreground"
                      )}>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMine && !msg.read_at && (
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-300/60">
                            <Clock size={9} />
                            Pending
                          </span>
                        )}
                        {isMine && msg.read_at && (
                          <span className="text-primary">✓ Read</span>
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
              className="glass-input h-11 flex-1 rounded-full px-4 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
                messageText.trim() && !sending
                  ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
                  : "glass-btn-pill text-muted-foreground cursor-not-allowed"
              )}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* First-time tip explaining that plate tiles are tappable. Only
          renders when there's at least one plate to anchor to. */}
      {listings.length > 0 && (
        <Coachmark
          id="customer-storefront-tile"
          copy={COACHMARK_COPY["customer-storefront-tile"]}
          targetRef={firstTileRef}
          showDelayMs={400}
        />
      )}

      {/* First-time tip on the CATERING tab — explains the flow is
          different (request → quote → deposit) before the customer
          taps in expecting plate-style instant-buy. */}
      {cateringListings.length > 0 && (
        <Coachmark
          id="customer-catering-tab"
          copy={COACHMARK_COPY["customer-catering-tab"]}
          targetRef={cateringTabRef}
          showDelayMs={600}
        />
      )}

      {/* Drive Thru floating launcher — always reachable while scrolling, so
          the flagship concierge is one tap away from anywhere on the page.
          Sits bottom-right, clear of the centered cart/catering bars. Hidden
          while the concierge is open. */}
      {!conciergeOpen && (
        <button
          type="button"
          onClick={() => setConciergeOpen(true)}
          aria-label="Ask Drive Thru"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] text-white shadow-[0_8px_28px_rgba(34,197,94,0.45)] transition-transform active:scale-90"
        >
          <Sparkles size={24} strokeWidth={2.3} />
        </button>
      )}

      {/* Drive Thru concierge sheet — lazy-mounted on first open. */}
      {conciergeOpen && (
        <ConciergeSheet
          open={conciergeOpen}
          onClose={() => setConciergeOpen(false)}
          onPickPlate={handlePickConciergePlate}
        />
      )}
    </main>
  );
}
