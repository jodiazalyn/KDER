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
