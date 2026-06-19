import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tools for the Super Dashboard analyst (Cleopatra VII).
 *
 * The agent (admin-gated, server-side) orchestrates *which* searches to
 * run; these functions do the deterministic Supabase reads against the
 * service-role client and return presentation-ready cards. The cards are
 * streamed straight to the cofounder's screen — they come from real query
 * results, never from model-guessed ids — while a slim text projection
 * (`forModel`) is fed back to the model so it can narrate accurately
 * without burning tokens on photo URLs and ids.
 *
 * The plate/creator searches accept rich filters (price range, fulfillment
 * type, category, status, order volume, KYC, rating, storefront, service
 * area) so a cofounder can interrogate the full range of options on the
 * KDER Club platform — not just keyword matches.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

// ── Card shapes (what the client renders) ─────────────────────────

export interface PlateCard {
  id: string;
  name: string;
  description: string | null;
  priceDollars: number;
  photo: string | null;
  status: string | null;
  fulfillment: string | null;
  categories: string[];
  allergens: string[];
  orderCount: number;
  creator: {
    id: string;
    name: string | null;
    handle: string | null;
    photo: string | null;
  };
}

export interface CreatorCard {
  id: string; // creators.id
  memberId: string;
  name: string | null;
  handle: string | null;
  photo: string | null;
  bio: string | null;
  kyc: string | null;
  storefrontActive: boolean;
  rating: number | null;
  reviewCount: number;
  listingCount: number;
  activeListingCount: number;
  serviceZips: string[];
  joinedAt: string;
  /** Public storefront path when the creator has a handle. */
  storefrontPath: string | null;
}

export type ToolResult =
  | { kind: "plates"; items: PlateCard[]; forModel: string }
  | { kind: "creators"; items: CreatorCard[]; forModel: string };

// Allowed enum-ish values, surfaced in the schemas so the model picks
// valid filters instead of guessing.
const PLATE_STATUSES = ["active", "paused", "draft", "archived"] as const;
const FULFILLMENT_TYPES = ["pickup", "delivery", "both", "onsite"] as const;
const KYC_STATUSES = ["verified", "pending", "failed", "not_started"] as const;
const PLATE_SORTS = ["popular", "price_asc", "price_desc", "newest"] as const;
const CREATOR_SORTS = ["newest", "rating", "name"] as const;

// ── Tool schemas handed to the model ──────────────────────────────

export const ADMIN_AGENT_TOOLS = [
  {
    name: "search_plates",
    description:
      "Search and filter plates/listings on the KDER Club platform. Use this whenever the cofounder asks about food, dishes, plates, prices, or fulfillment — e.g. 'creators who have spaghetti meals', 'delivery plates under $20', 'most popular vegan dishes', 'paused listings over $50'. All arguments are optional: omit `query` to browse purely by filters (price, fulfillment, category, status). Returns matching plates with the creator who owns each one.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text search over plate name + description, e.g. 'spaghetti', 'vegan', 'jerk chicken'. Keep it to the key food terms. Omit to browse by filters alone.",
        },
        minPrice: {
          type: "number",
          description: "Minimum price in dollars (inclusive).",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in dollars (inclusive).",
        },
        fulfillmentType: {
          type: "string",
          enum: [...FULFILLMENT_TYPES],
          description:
            "Filter by how the plate is fulfilled. 'delivery' also matches plates set to 'both'; 'pickup' also matches 'both'. 'onsite' = served at an event/venue.",
        },
        category: {
          type: "string",
          description:
            "Filter by a category tag (matches the plate's category_tags), e.g. 'dessert', 'vegan', 'bbq'.",
        },
        status: {
          type: "string",
          enum: [...PLATE_STATUSES],
          description: "Exact listing status. Omit to include all statuses.",
        },
        minOrders: {
          type: "number",
          description:
            "Only plates with at least this many lifetime orders (gauge traction/popularity).",
        },
        sort: {
          type: "string",
          enum: [...PLATE_SORTS],
          description:
            "Result ordering: 'popular' (most orders, default), 'price_asc', 'price_desc', or 'newest'.",
        },
        limit: {
          type: "number",
          description: "Max results (default 12, max 30).",
        },
      },
    },
  },
  {
    name: "search_creators",
    description:
      "Search and filter creators on the KDER Club platform. Use for 'find creator @joe', 'creators whose bio mentions BBQ', 'verified creators in 90210', 'top-rated creators', or 'who needs attention'. All arguments are optional. Returns creator cards with KYC, storefront state, rating, service area, and listing counts.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text over display name, handle, and bio. Omit to list creators by the chosen sort.",
        },
        kycStatus: {
          type: "string",
          enum: [...KYC_STATUSES],
          description: "Filter by Stripe KYC/onboarding status.",
        },
        storefrontActive: {
          type: "boolean",
          description:
            "true = only creators with a live storefront; false = only creators whose storefront is off.",
        },
        minRating: {
          type: "number",
          description:
            "Only creators with an average review rating at or above this (0–5).",
        },
        zip: {
          type: "string",
          description:
            "Filter to creators who serve this ZIP code (matches their service area).",
        },
        onlyNeedsAttention: {
          type: "boolean",
          description:
            "When true, return only creators that need a nudge: KYC not verified, storefront off, or zero listings.",
        },
        sort: {
          type: "string",
          enum: [...CREATOR_SORTS],
          description:
            "Result ordering: 'newest' (default), 'rating' (highest first), or 'name' (A–Z).",
        },
        limit: {
          type: "number",
          description: "Max results (default 12, max 30).",
        },
      },
    },
  },
  {
    name: "get_creator",
    description:
      "Deep-dive a single creator by @handle (preferred) or creator id. Returns the creator card plus all of their plates. Use when the cofounder wants everything one creator is selling.",
    input_schema: {
      type: "object",
      properties: {
        handle: {
          type: "string",
          description: "Creator @handle (the @ is optional).",
        },
        id: { type: "string", description: "Creator id (uuid)." },
      },
    },
  },
] as const;

// ── Dispatcher ────────────────────────────────────────────────────

export async function runAdminTool(
  name: string,
  input: Record<string, unknown>,
  service: DB
): Promise<ToolResult> {
  switch (name) {
    case "search_plates":
      return searchPlates(service, {
        query: optStr(input.query),
        minPrice: optNum(input.minPrice),
        maxPrice: optNum(input.maxPrice),
        fulfillmentType: optEnum(input.fulfillmentType, FULFILLMENT_TYPES),
        category: optStr(input.category),
        status: optEnum(input.status, PLATE_STATUSES),
        minOrders: optNum(input.minOrders),
        sort: optEnum(input.sort, PLATE_SORTS) ?? "popular",
        limit: clampLimit(input.limit),
      });
    case "search_creators":
      return searchCreators(service, {
        query: optStr(input.query),
        kycStatus: optEnum(input.kycStatus, KYC_STATUSES),
        storefrontActive:
          typeof input.storefrontActive === "boolean"
            ? input.storefrontActive
            : undefined,
        minRating: optNum(input.minRating),
        zip: optStr(input.zip),
        onlyNeedsAttention: input.onlyNeedsAttention === true,
        sort: optEnum(input.sort, CREATOR_SORTS) ?? "newest",
        limit: clampLimit(input.limit),
      });
    case "get_creator":
      return getCreator(service, {
        handle: optStr(input.handle),
        id: optStr(input.id),
      });
    default:
      return { kind: "plates", items: [], forModel: `Unknown tool: ${name}` };
  }
}

// ── search_plates ─────────────────────────────────────────────────

interface PlateArgs {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  fulfillmentType?: string;
  category?: string;
  status?: string;
  minOrders?: number;
  sort: (typeof PLATE_SORTS)[number];
  limit: number;
}

async function searchPlates(service: DB, args: PlateArgs): Promise<ToolResult> {
  const term = args.query ? sanitize(args.query) : "";

  let q = service
    .from("listings")
    .select(
      "id, creator_id, name, description, price, photos, status, fulfillment_type, category_tags, allergens, order_count, created_at"
    )
    .limit(args.limit);

  if (term) {
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (args.status) q = q.eq("status", args.status);
  if (args.minPrice != null) q = q.gte("price", args.minPrice);
  if (args.maxPrice != null) q = q.lte("price", args.maxPrice);
  if (args.minOrders != null) q = q.gte("order_count", args.minOrders);
  if (args.category) {
    // category_tags is a text[]; `contains` matches the tag exactly.
    q = q.contains("category_tags", [args.category]);
  }
  if (args.fulfillmentType) {
    // 'delivery' plates that are set to 'both' still deliver; same for
    // pickup. Match the inclusive set rather than an exact equality.
    const ft = args.fulfillmentType;
    const set =
      ft === "delivery"
        ? ["delivery", "both"]
        : ft === "pickup"
          ? ["pickup", "both"]
          : [ft];
    q = q.in("fulfillment_type", set);
  }

  switch (args.sort) {
    case "price_asc":
      q = q.order("price", { ascending: true });
      break;
    case "price_desc":
      q = q.order("price", { ascending: false });
      break;
    case "newest":
      q = q.order("created_at", { ascending: false });
      break;
    case "popular":
    default:
      q = q.order("order_count", { ascending: false });
      break;
  }

  const { data, error } = await q;
  if (error) {
    return {
      kind: "plates",
      items: [],
      forModel: `search_plates failed: ${error.message}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const creatorMap = await loadCreatorMembers(
    service,
    rows.map((r) => r.creator_id as string)
  );

  const items: PlateCard[] = rows.map((r) => {
    const c = creatorMap.get(r.creator_id as string);
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      priceDollars: Number(r.price ?? 0),
      photo: firstPhoto(r.photos),
      status: r.status ?? null,
      fulfillment: r.fulfillment_type ?? null,
      categories: Array.isArray(r.category_tags) ? r.category_tags : [],
      allergens: Array.isArray(r.allergens) ? r.allergens : [],
      orderCount: Number(r.order_count ?? 0),
      creator: {
        id: r.creator_id,
        name: c?.name ?? null,
        handle: c?.handle ?? null,
        photo: c?.photo ?? null,
      },
    };
  });

  const filterSummary = describePlateFilters(args);
  const forModel =
    items.length === 0
      ? `No plates matched${filterSummary ? ` (${filterSummary})` : ""}.`
      : `${items.length} plate(s)${filterSummary ? ` matching ${filterSummary}` : ""}:\n` +
        items
          .map(
            (p) =>
              `- ${p.name} ($${p.priceDollars.toFixed(2)}, ${p.fulfillment ?? "?"}, ${p.status ?? "?"}, ${p.orderCount} orders) by ${p.creator.handle ? "@" + p.creator.handle : p.creator.name ?? "unknown"}`
          )
          .join("\n");

  return { kind: "plates", items, forModel };
}

// ── search_creators ───────────────────────────────────────────────

interface CreatorArgs {
  query?: string;
  kycStatus?: string;
  storefrontActive?: boolean;
  minRating?: number;
  zip?: string;
  onlyNeedsAttention: boolean;
  sort: (typeof CREATOR_SORTS)[number];
  limit: number;
}

async function searchCreators(
  service: DB,
  args: CreatorArgs
): Promise<ToolResult> {
  // Text search lives on members (name/handle/bio); creator-level filters
  // (KYC, storefront, rating, zip) live on creators. Resolve text → member
  // ids first, then filter on the creators table so the DB does the work.
  let textMemberIds: string[] | null = null;
  if (args.query) {
    const term = sanitize(args.query);
    if (term) {
      const { data } = await service
        .from("members")
        .select("id")
        .eq("role", "creator")
        .or(
          `display_name.ilike.%${term}%,handle.ilike.%${term}%,bio.ilike.%${term}%`
        )
        .limit(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      textMemberIds = ((data ?? []) as any[]).map((m) => m.id as string);
      if (textMemberIds.length === 0) {
        return {
          kind: "creators",
          items: [],
          forModel: `No creators matched "${args.query}".`,
        };
      }
    }
  }

  // Over-fetch when we'll post-filter (needsAttention / name sort) so the
  // limit still yields a full page after JS filtering.
  const dbLimit = args.onlyNeedsAttention ? 60 : args.limit;

  let cq = service
    .from("creators")
    .select(
      "id, member_id, kyc_status, storefront_active, review_rating_avg, review_count, service_zip_codes, created_at"
    )
    .limit(dbLimit);

  if (args.kycStatus) cq = cq.eq("kyc_status", args.kycStatus);
  if (args.storefrontActive != null)
    cq = cq.eq("storefront_active", args.storefrontActive);
  if (args.minRating != null)
    cq = cq.gte("review_rating_avg", args.minRating);
  if (args.zip) cq = cq.contains("service_zip_codes", [args.zip]);
  if (textMemberIds) cq = cq.in("member_id", textMemberIds);

  if (args.sort === "rating") {
    cq = cq.order("review_rating_avg", { ascending: false, nullsFirst: false });
  } else {
    // 'newest' default; 'name' is sorted in JS after the member join.
    cq = cq.order("created_at", { ascending: false });
  }

  const { data: creators, error } = await cq;
  if (error) {
    return {
      kind: "creators",
      items: [],
      forModel: `search_creators failed: ${error.message}`,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorRows = (creators ?? []) as any[];
  if (creatorRows.length === 0) {
    return {
      kind: "creators",
      items: [],
      forModel: "No creators matched those filters.",
    };
  }

  const cards = await buildCreatorCards(service, creatorRows);

  let filtered = args.onlyNeedsAttention
    ? cards.filter(
        (c) =>
          c.kyc !== "verified" || !c.storefrontActive || c.listingCount === 0
      )
    : cards;

  if (args.sort === "name") {
    filtered = [...filtered].sort((a, b) =>
      (a.name ?? a.handle ?? "").localeCompare(b.name ?? b.handle ?? "")
    );
  }
  filtered = filtered.slice(0, args.limit);

  const filterSummary = describeCreatorFilters(args);
  const forModel =
    filtered.length === 0
      ? `No creators matched${filterSummary ? ` (${filterSummary})` : ""}.`
      : `${filtered.length} creator(s)${filterSummary ? ` matching ${filterSummary}` : ""}:\n` +
        filtered
          .map(
            (c) =>
              `- ${c.name ?? "?"} ${c.handle ? "(@" + c.handle + ")" : ""}: KYC ${c.kyc ?? "?"}, storefront ${c.storefrontActive ? "on" : "off"}, ${c.listingCount} listings (${c.activeListingCount} active), rating ${c.rating ?? "—"}${c.serviceZips.length ? `, serves ${c.serviceZips.slice(0, 3).join("/")}` : ""}`
          )
          .join("\n");

  return { kind: "creators", items: filtered, forModel };
}

// ── get_creator ───────────────────────────────────────────────────

async function getCreator(
  service: DB,
  args: { handle?: string; id?: string }
): Promise<ToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let creatorRow: any = null;

  if (args.id) {
    const { data } = await service
      .from("creators")
      .select(
        "id, member_id, kyc_status, storefront_active, review_rating_avg, review_count, service_zip_codes, created_at"
      )
      .eq("id", args.id)
      .maybeSingle();
    creatorRow = data;
  } else if (args.handle) {
    const h = args.handle.replace(/^@/, "").trim();
    const { data: member } = await service
      .from("members")
      .select("id")
      .ilike("handle", h)
      .eq("role", "creator")
      .maybeSingle();
    if (member?.id) {
      const { data } = await service
        .from("creators")
        .select(
          "id, member_id, kyc_status, storefront_active, review_rating_avg, review_count, service_zip_codes, created_at"
        )
        .eq("member_id", member.id)
        .maybeSingle();
      creatorRow = data;
    }
  }

  if (!creatorRow) {
    return {
      kind: "creators",
      items: [],
      forModel: `No creator found for ${args.handle ?? args.id ?? "(no identifier)"}.`,
    };
  }

  const cards = await buildCreatorCards(service, [creatorRow]);
  if (cards.length === 0) {
    return {
      kind: "creators",
      items: [],
      forModel: "Creator record incomplete.",
    };
  }
  const c = cards[0];
  const forModel = `Creator ${c.handle ? "@" + c.handle : c.name ?? "?"} — ${c.listingCount} listings (${c.activeListingCount} active), KYC ${c.kyc ?? "?"}, storefront ${c.storefrontActive ? "on" : "off"}, rating ${c.rating ?? "—"}${c.serviceZips.length ? `, serves ${c.serviceZips.slice(0, 3).join("/")}` : ""}.`;

  return { kind: "creators", items: cards, forModel };
}

// ── Shared assembly helpers ───────────────────────────────────────

/** Map creator_id → { name, handle, photo } via creators→members. */
async function loadCreatorMembers(
  service: DB,
  creatorIds: string[]
): Promise<
  Map<string, { name: string | null; handle: string | null; photo: string | null }>
> {
  const map = new Map<
    string,
    { name: string | null; handle: string | null; photo: string | null }
  >();
  const ids = [...new Set(creatorIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data: creators } = await service
    .from("creators")
    .select("id, member_id")
    .in("id", ids);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorRows = (creators ?? []) as any[];
  const memberIds = creatorRows.map((c) => c.member_id).filter(Boolean);

  const { data: members } = await service
    .from("members")
    .select("id, display_name, handle, photo_url")
    .in("id", memberIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberById = new Map<string, any>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((members ?? []) as any[]).map((m) => [m.id, m])
  );

  for (const c of creatorRows) {
    const m = memberById.get(c.member_id);
    map.set(c.id, {
      name: m?.display_name ?? null,
      handle: m?.handle ?? null,
      photo: m?.photo_url ?? null,
    });
  }
  return map;
}

/** Turn creator rows into full CreatorCards: joins the member profile and
 *  computes per-creator listing counts. */
async function buildCreatorCards(
  service: DB,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creatorRows: any[]
): Promise<CreatorCard[]> {
  if (creatorRows.length === 0) return [];

  const memberIds = creatorRows.map((c) => c.member_id).filter(Boolean);
  const { data: members } = await service
    .from("members")
    .select("id, display_name, handle, photo_url, bio")
    .in("id", memberIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberById = new Map<string, any>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((members ?? []) as any[]).map((m) => [m.id, m])
  );

  const creatorIds = creatorRows.map((c) => c.id);
  const listingCount = new Map<string, number>();
  const activeCount = new Map<string, number>();
  if (creatorIds.length > 0) {
    const { data: listings } = await service
      .from("listings")
      .select("creator_id, status")
      .in("creator_id", creatorIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (listings ?? []) as any[]) {
      listingCount.set(l.creator_id, (listingCount.get(l.creator_id) ?? 0) + 1);
      if (l.status === "active") {
        activeCount.set(l.creator_id, (activeCount.get(l.creator_id) ?? 0) + 1);
      }
    }
  }

  const cards: CreatorCard[] = [];
  for (const c of creatorRows) {
    const m = memberById.get(c.member_id);
    cards.push({
      id: c.id,
      memberId: c.member_id,
      name: m?.display_name ?? null,
      handle: m?.handle ?? null,
      photo: m?.photo_url ?? null,
      bio: m?.bio ?? null,
      kyc: c.kyc_status ?? null,
      storefrontActive: c.storefront_active === true,
      rating: c.review_rating_avg ?? null,
      reviewCount: Number(c.review_count ?? 0),
      listingCount: listingCount.get(c.id) ?? 0,
      activeListingCount: activeCount.get(c.id) ?? 0,
      serviceZips: Array.isArray(c.service_zip_codes) ? c.service_zip_codes : [],
      joinedAt: c.created_at,
      storefrontPath: m?.handle ? `/${m.handle}` : null,
    });
  }
  return cards;
}

// ── Filter summaries (for the model-facing text) ──────────────────

function describePlateFilters(a: PlateArgs): string {
  const parts: string[] = [];
  if (a.query) parts.push(`"${a.query}"`);
  if (a.minPrice != null && a.maxPrice != null)
    parts.push(`$${a.minPrice}–$${a.maxPrice}`);
  else if (a.minPrice != null) parts.push(`≥$${a.minPrice}`);
  else if (a.maxPrice != null) parts.push(`≤$${a.maxPrice}`);
  if (a.fulfillmentType) parts.push(a.fulfillmentType);
  if (a.category) parts.push(`#${a.category}`);
  if (a.status) parts.push(a.status);
  if (a.minOrders != null) parts.push(`≥${a.minOrders} orders`);
  return parts.join(", ");
}

function describeCreatorFilters(a: CreatorArgs): string {
  const parts: string[] = [];
  if (a.query) parts.push(`"${a.query}"`);
  if (a.kycStatus) parts.push(`KYC ${a.kycStatus}`);
  if (a.storefrontActive != null)
    parts.push(a.storefrontActive ? "storefront on" : "storefront off");
  if (a.minRating != null) parts.push(`rating ≥${a.minRating}`);
  if (a.zip) parts.push(`serves ${a.zip}`);
  if (a.onlyNeedsAttention) parts.push("needs attention");
  return parts.join(", ");
}

// ── Sanitization + small utils ────────────────────────────────────

/**
 * Strip characters that would break a PostgREST `.or(...)` filter
 * (commas, parens, the ilike wildcard) and collapse whitespace. Keeps
 * letters, numbers, spaces, and a few benign punctuation marks.
 */
function sanitize(raw: string): string {
  return raw
    .replace(/[%,()*\\"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && photos.length > 0) {
    const p = photos[0];
    return typeof p === "string" && p.length > 0 ? p : null;
  }
  return null;
}

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function optNum(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function optEnum<T extends readonly string[]>(
  v: unknown,
  allowed: T
): T[number] | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T[number])
    : undefined;
}
function clampLimit(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(30, Math.floor(n)));
}
