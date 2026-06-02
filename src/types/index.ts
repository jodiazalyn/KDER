export const ORDER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const LISTING_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
} as const;

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

export const FULFILLMENT_TYPE = {
  PICKUP: "pickup",
  DELIVERY: "delivery",
  BOTH: "both",
} as const;

export type FulfillmentType =
  (typeof FULFILLMENT_TYPE)[keyof typeof FULFILLMENT_TYPE];

export const MEMBER_ROLE = {
  MEMBER: "member",
  CREATOR: "creator",
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

export const KYC_STATUS = {
  NOT_STARTED: "not_started",
  PENDING: "pending",
  VERIFIED: "verified",
  FAILED: "failed",
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

// --- Listing types ---

export interface AvailabilityWindow {
  date: string;
  start_time: string;
  end_time: string;
}

export interface DiscountCode {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_order: number | null;
  expires_at: string | null;
}

/** What type of listing this is. Catering uses an inquiry → quote
 *  → deposit flow instead of one-shot checkout, with extra setup
 *  fields (pricing mode, lead time, min/max guests, etc.). */
export type ListingKind = "plate" | "catering";

/** How a catering listing is priced. */
export type CateringPricingMode = "per_head" | "flat";

/** Fulfillment options for catering. A listing can support any subset. */
export type CateringFulfillment = "pickup" | "delivery" | "onsite";

/** Food-category buckets the creator uses to organize what's included in a
 *  catering listing. Fixed list — easier to render and lets the storefront
 *  card layout reason about ordering. Edit this list to add a new category;
 *  no DB change needed since `catering_inclusion_groups` is JSONB. */
export const CATERING_INCLUSION_CATEGORIES = [
  "Protein",
  "Sides",
  "Desserts",
  "Add-ons",
  "Drinks",
  "Toppings/Sauces",
] as const;

export type CateringInclusionCategory =
  (typeof CATERING_INCLUSION_CATEGORIES)[number];

/** Map of category → items. Categories with no items are typically omitted
 *  to keep the JSON small, but rendering code shouldn't assume every key
 *  exists. */
export type CateringInclusionGroups = Partial<
  Record<CateringInclusionCategory, string[]>
>;

export interface Listing {
  id: string;
  creator_id: string;
  kind: ListingKind;
  name: string;
  description: string;
  price: number;
  quantity: number;
  min_order: number | null;
  photos: string[];
  video: string | null;
  fulfillment_type: FulfillmentType;
  status: ListingStatus;
  category_tags: string[];
  allergens: string[];
  availability_windows: AvailabilityWindow[];
  discount_codes: DiscountCode[];
  order_count: number;
  created_at: string;
  updated_at: string;

  // Plate-only: pre-order date. When set, this plate is marked as
  // pre-order (food ready on that date) instead of instant. NULL =
  // instant (the historical default). ISO date string "YYYY-MM-DD"
  // — matches Postgres DATE format the same way other date columns
  // in this codebase do (catering inquiry event_date, etc.).
  pre_order_available_date: string | null;

  // Catering-only fields. All null for kind='plate'.
  catering_pricing_mode: CateringPricingMode | null;
  catering_min_guests: number | null;
  catering_max_guests: number | null;
  catering_lead_time_hours: number | null;
  catering_fulfillment: CateringFulfillment[];
  catering_inclusions: string | null;
  /** Structured menu groups (Protein / Sides / Desserts / etc.). Empty
   *  object for plates or for catering listings created before this
   *  was introduced — UI falls back to `catering_inclusions` text when
   *  this is empty. */
  catering_inclusion_groups: CateringInclusionGroups;

  /** Plate-only optional add-ons offered at checkout (migration 018).
   *  Each entry: {name, price_cents}. price_cents may be 0 (free
   *  extras like "extra spice"). Always an empty array for catering
   *  listings — they use fee_items on quotes for the same role. */
  extras: ListingExtra[];

  /** Plate-only pickup address for Uber Direct delivery orders
   *  (migration 019). NULL on pickup-only listings + on catering
   *  (catering has its own pickup model via inquiries/bookings).
   *  Required at the API layer when the listing is active AND
   *  fulfillment_type includes delivery. */
  pickup_address: string | null;
  /** Optional courier instructions shown at pickup. Max 280 chars
   *  per Uber Direct. */
  pickup_instructions: string | null;
}

/** One add-on offered by the creator on a plate listing.
 *  price_cents may be 0 — free extras (e.g. "extra spice") are
 *  meaningful as customer-visible options, not just paid ones. */
export interface ListingExtra {
  name: string;
  price_cents: number;
}

/** A customer's pick of an extra inside a cart line. Snapshots both
 *  the name and price at add-time so a creator editing the listing
 *  later doesn't retroactively shift pending carts. */
export interface CartItemExtra {
  name: string;
  price_cents: number;
  qty: number;
}

/** A creator's calendar blackout. `one_off` blocks a specific date;
 *  `recurring` blocks every {weekday} forever (e.g., always closed Mondays). */
export interface CreatorBlackout {
  id: string;
  creator_id: string;
  kind: "one_off" | "recurring";
  /** Set only when kind='one_off'. ISO date (YYYY-MM-DD). */
  blackout_date: string | null;
  /** Set only when kind='recurring'. 0=Sunday, 6=Saturday. */
  weekday: number | null;
  reason: string | null;
  created_at: string;
}

/** Where the event is happening. */
export type CateringVenueType = "residence" | "venue" | "other";

/** Indoor / outdoor / mixed — relevant for setup logistics. */
export type CateringIndoorOutdoor = "indoor" | "outdoor" | "mixed";

/** Inquiry lifecycle:
 *  - open      → just submitted, creator hasn't quoted yet
 *  - quoted    → creator sent a quote (lives in catering_quotes)
 *  - booked    → customer paid the deposit
 *  - declined  → creator declined
 *  - expired   → no quote within the inquiry-expiry window */
export type CateringInquiryStatus =
  | "open"
  | "quoted"
  | "booked"
  | "declined"
  | "expired";

/** Single row in a catering quote. `listing_id` is optional — creators
 *  can add custom line items (e.g., "Travel fee — out-of-zone delivery")
 *  that don't tie back to a published catering listing. */
export interface CateringQuoteLineItem {
  name: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  listing_id?: string | null;
}

/** Lifecycle of a quote.
 *  - draft → not used in v1 (reserved for save-draft pattern)
 *  - sent → delivered to customer
 *  - accepted → customer paid the deposit (a booking now exists)
 *  - declined → customer explicitly rejected
 *  - expired → past expires_at without action
 *  - superseded → creator sent a new quote replacing this one */
export type CateringQuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "superseded";

/** Creator's quote in response to a catering inquiry. */
export interface CateringQuote {
  id: string;
  inquiry_id: string;
  creator_id: string;
  member_id: string;

  line_items: CateringQuoteLineItem[];
  food_subtotal_cents: number;
  fees_cents: number;
  tax_cents: number;
  total_cents: number;
  deposit_cents: number;
  balance_cents: number;

  creator_notes: string | null;
  expires_at: string;     // ISO
  status: CateringQuoteStatus;
  created_at: string;
  updated_at: string;
}

/** Catering booking lifecycle. */
export type CateringBookingStatus =
  | "pending_acceptance" // deposit paid, creator hasn't accepted yet
  | "confirmed"          // creator accepted, awaiting balance + event
  | "balance_due"        // balance charge failed, needs manual retry
  | "balance_paid"       // balance successfully charged
  | "completed"          // event is over
  | "cancelled";

/** Real booking row once the deposit has been paid. */
export interface CateringBooking {
  id: string;
  quote_id: string;
  inquiry_id: string;
  creator_id: string;
  member_id: string;

  event_date: string;          // YYYY-MM-DD
  event_time: string | null;   // HH:MM:SS

  status: CateringBookingStatus;

  total_cents: number;
  deposit_cents: number;
  balance_cents: number;

  stripe_customer_id: string | null;
  deposit_payment_intent_id: string;
  deposit_paid_at: string;     // ISO
  balance_payment_method_id: string | null;
  balance_payment_intent_id: string | null;
  balance_charged_at: string | null;
  balance_charge_scheduled_for: string | null;

  accept_deadline: string | null; // ISO
  cancellation_reason: string | null;
  notes_for_creator: string | null;

  created_at: string;
  updated_at: string;
}

/** Customer-submitted request for catering. The "intent" that
 *  becomes a quote (PR 3) and then a booking (PR 3/4). */
export interface CateringInquiry {
  id: string;
  creator_id: string;
  member_id: string;

  event_date: string;            // YYYY-MM-DD
  event_time: string | null;     // HH:MM:SS
  event_end_time: string | null; // HH:MM:SS
  guest_count: number;

  event_address: string | null;
  event_venue_type: CateringVenueType | null;
  indoor_outdoor: CateringIndoorOutdoor | null;

  needs_server: boolean;
  needs_setup: boolean;
  earliest_setup_time: string | null;
  kitchen_available: boolean | null;

  allergies: string | null;
  notes: string | null;

  pre_selected_listing_ids: string[];

  status: CateringInquiryStatus;
  created_at: string;
  updated_at: string;
}

export const CATEGORIES = [
  // Cuisines & regional
  "Soul Food",
  "BBQ",
  "Seafood",
  "Mexican",
  "Tex-Mex",
  "Caribbean",
  "Jamaican",
  "West African",
  "Nigerian",
  "Ethiopian",
  "Cajun & Creole",
  "Salvadoran",
  "Indian",
  "Vietnamese",
  "Thai",
  "Filipino",
  "Chinese",
  "Korean",
  "Japanese",
  "Mediterranean",
  "Italian",
  // Food types
  "Breakfast & Brunch",
  "Desserts",
  "Baked Goods",
  "Sides",
  "Snacks",
  "Soups & Stews",
  "Pasta",
  "Rice Dishes",
  "Tacos",
  "Wings",
  "Sandwiches",
  "Bowls",
  "Platters",
  "Salads",
  "Drinks",
  // Dietary
  "Vegan",
  "Vegetarian",
  "Keto",
  "Gluten-Free",
  "Halal",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_GROUPS: Record<string, string[]> = {
  Cuisines: [
    "Soul Food", "BBQ", "Seafood", "Mexican", "Tex-Mex", "Caribbean",
    "Jamaican", "West African", "Nigerian", "Ethiopian", "Cajun & Creole",
    "Salvadoran", "Indian", "Vietnamese", "Thai", "Filipino", "Chinese",
    "Korean", "Japanese", "Mediterranean", "Italian",
  ],
  "Food Types": [
    "Breakfast & Brunch", "Desserts", "Baked Goods", "Sides", "Snacks",
    "Soups & Stews", "Pasta", "Rice Dishes", "Tacos", "Wings",
    "Sandwiches", "Bowls", "Platters", "Salads", "Drinks",
  ],
  Dietary: ["Vegan", "Vegetarian", "Keto", "Gluten-Free", "Halal"],
};

export const ALLERGENS = [
  "Peanuts",
  "Tree Nuts",
  "Dairy",
  "Eggs",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
] as const;

export type Allergen = (typeof ALLERGENS)[number];

// --- Order types ---

export interface Order {
  id: string;
  listing_id: string;
  member_id: string;
  creator_id: string;
  quantity: number;
  fulfillment_type: FulfillmentType;
  status: OrderStatus;
  total_amount: number;
  platform_fee: number;
  creator_payout: number;
  notes: string | null;
  terms_accepted_at: string;
  auto_decline_at: string;
  created_at: string;
  updated_at: string;
  // Reminder tracking — populated by the cron sweep
  reminder_count: number;
  last_reminder_at: string | null;
  // Address fields
  delivery_address: string | null;
  delivery_zip: string | null;
  pickup_address: string | null; // creator's address, revealed after accept
  member_phone: string | null;
  customer_email: string | null;
  // Denormalized for display
  member_name: string;
  member_photo: string | null;
  listing_name: string;
  listing_photo: string | null;
  /** Full JSONB items array snapshotted at checkout (migration 018+).
   *  Each row: {listing_id, name, price, quantity, photo, extras?}.
   *  Older orders omit `extras` per row — render path treats
   *  missing/empty as no extras. May be undefined if a fetch query
   *  doesn't select the column. */
  items?: OrderItemSnapshot[];
}

/** One snapshot row inside Order.items. The cart-line shape at
 *  checkout time — what the customer actually paid for. Prices are
 *  in dollars (legacy) but extras prices are in cents (newer model)
 *  to match the snapshot format used by migration 018. */
export interface OrderItemSnapshot {
  listing_id: string;
  name: string;
  price: number; // dollars (legacy)
  quantity: number;
  photo: string | null;
  /** Optional add-ons the customer picked at checkout. Each row:
   *  {name, price_cents, qty}. Omitted on pre-018 orders. */
  extras?: Array<{ name: string; price_cents: number; qty: number }>;
}

// --- Message types ---

export interface Message {
  id: string;
  order_id: string | null;
  sender_id: string;
  recipient_id: string;
  body: string;
  media_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  threadId: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId: string | null;
  /** True when any message in this thread is a catering-system
   *  message (inserted by insertCateringThreadMessage). Drives
   *  the "Catering" pill on the inbox row so creators can scan
   *  for catering threads at a glance. Optional for back-compat
   *  with older payloads. */
  isCatering?: boolean;
}

// --- Gamification types ---

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastOrderDate: string | null;
  isActive: boolean; // true if streak is still alive (order today or yesterday)
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  tier: "bronze" | "silver" | "gold" | "diamond";
  earnedAt: string | null; // null = not earned
}

export interface LeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  handle: string;
  photoUrl: string | null;
  vibeScore: number;
  totalOrders: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

// --- API ---

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
