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

export interface Listing {
  id: string;
  creator_id: string;
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
}

export const CATEGORIES = [
  "Soul Food",
  "BBQ",
  "Seafood",
  "Mexican",
  "Caribbean",
  "Desserts",
  "Breakfast",
  "Vegan",
  "Sides",
  "Drinks",
] as const;

export type Category = (typeof CATEGORIES)[number];

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
