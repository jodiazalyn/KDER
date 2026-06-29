import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tools for the public storefront concierge ("Drive Thru").
 *
 * This is the CUSTOMER-FACING cousin of the admin analyst's tools
 * (`src/lib/admin/agent-tools.ts`). The agent (public, server-side) decides
 * *which* searches to run; this function does the deterministic Supabase
 * reads against the ANON client and returns presentation-ready cards.
 *
 * Hard safety differences from the admin tools — a visitor must never see
 * back-office data:
 *   - Only `status = 'active'` plates are ever returned.
 *   - Only plates whose creator has `storefront_active = true` are returned.
 *   - Only `kind = 'plate'` (catering is a separate quote flow, not orderable
 *     from the concierge).
 *   - The card carries NO KYC, service area, draft/paused state, or order
 *     internals beyond a public popularity count.
 *
 * Every card comes from a real query row (never model-guessed ids), and each
 * carries its `creator.handle` so the client can bridge a pick straight into
 * that creator's existing order flow (`/<handle>?plate=<id>`).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

// ── Card shape (what the client renders) ──────────────────────────

export interface ConciergePlateCard {
  id: string;
  name: string;
  description: string | null;
  priceDollars: number;
  photo: string | null;
  fulfillment: string | null;
  categories: string[];
  allergens: string[];
  orderCount: number;
  creator: {
    name: string | null;
    handle: string | null;
    photo: string | null;
  };
}

export type ConciergeToolResult = {
  kind: "plates";
  items: ConciergePlateCard[];
  forModel: string;
};

const FULFILLMENT_TYPES = ["pickup", "delivery", "both", "onsite"] as const;
const PLATE_SORTS = ["popular", "price_asc", "price_desc", "newest"] as const;

// ── Tool schema handed to the model ───────────────────────────────

export const CONCIERGE_TOOLS = [
  {
    name: "search_plates",
    description:
      "Search live, orderable plates across the ENTIRE KDER marketplace (every creator, not just the storefront the visitor is on). Use this whenever the visitor describes food they're craving, a dietary goal, ingredients, a budget, or how they want it fulfilled — e.g. 'high-protein lunch under $15', 'vegan dessert', 'keto-friendly dinner for delivery', 'jerk chicken near me'. All arguments are optional: omit `query` to browse purely by filters. Only active, in-stock plates from live storefronts are returned.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text over plate name + description. Pass just the core food terms (e.g. 'salmon bowl', 'vegan', 'protein'), not the visitor's full sentence. Omit to browse by filters alone.",
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
            "How the visitor wants it: 'delivery' (also matches plates set to 'both'), 'pickup' (also matches 'both'), or 'onsite'.",
        },
        category: {
          type: "string",
          description:
            "A single diet/cuisine/category tag to require, e.g. 'vegan', 'keto', 'dessert', 'bbq'. Use for strict dietary filters; use `query` for looser matches.",
        },
        minOrders: {
          type: "number",
          description:
            "Only plates with at least this many lifetime orders — use when the visitor wants popular / proven picks.",
        },
        sort: {
          type: "string",
          enum: [...PLATE_SORTS],
          description:
            "Ordering: 'popular' (default), 'price_asc' (cheapest first), 'price_desc', or 'newest'.",
        },
        limit: {
          type: "number",
          description: "Max results (default 8, max 20).",
        },
      },
    },
  },
] as const;

// ── Dispatcher ────────────────────────────────────────────────────

export async function runConciergeTool(
  name: string,
  input: Record<string, unknown>,
  anon: DB
): Promise<ConciergeToolResult> {
  switch (name) {
    case "search_plates":
      return searchPlates(anon, {
        query: optStr(input.query),
        minPrice: optNum(input.minPrice),
        maxPrice: optNum(input.maxPrice),
        fulfillmentType: optEnum(input.fulfillmentType, FULFILLMENT_TYPES),
        category: optStr(input.category),
        minOrders: optNum(input.minOrders),
        sort: optEnum(input.sort, PLATE_SORTS) ?? "popular",
        limit: clampLimit(input.limit),
      });
    default:
      return {
        kind: "plates",
        items: [],
        forModel: `Unknown tool: ${name}`,
      };
  }
}

// ── search_plates (customer-safe) ─────────────────────────────────

interface PlateArgs {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  fulfillmentType?: string;
  category?: string;
  minOrders?: number;
  sort: (typeof PLATE_SORTS)[number];
  limit: number;
}

async function searchPlates(
  anon: DB,
  args: PlateArgs
): Promise<ConciergeToolResult> {
  const term = args.query ? sanitize(args.query) : "";

  // Over-fetch: we filter out plates whose creator's storefront is off
  // *after* the query (that flag lives on `creators`, not `listings`), so
  // pull extra headroom to still fill a page.
  const dbLimit = Math.min(args.limit * 3, 60);

  let q = anon
    .from("listings")
    .select(
      "id, creator_id, name, description, price, photos, fulfillment_type, category_tags, allergens, order_count, created_at"
    )
    // Non-negotiable customer guards: live + orderable single plates only.
    .eq("status", "active")
    .eq("kind", "plate")
    .limit(dbLimit);

  if (term) {
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (args.minPrice != null) q = q.gte("price", args.minPrice);
  if (args.maxPrice != null) q = q.lte("price", args.maxPrice);
  if (args.minOrders != null) q = q.gte("order_count", args.minOrders);
  if (args.category) q = q.contains("category_tags", [args.category]);
  if (args.fulfillmentType) {
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
  if (rows.length === 0) {
    const summary = describeFilters(args);
    return {
      kind: "plates",
      items: [],
      forModel: `No plates matched${summary ? ` (${summary})` : ""}.`,
    };
  }

  // Resolve creators → keep only those with a LIVE storefront, and pull
  // public member fields for the card.
  const liveCreators = await loadLiveCreators(
    anon,
    rows.map((r) => r.creator_id as string)
  );

  const items: ConciergePlateCard[] = [];
  for (const r of rows) {
    const c = liveCreators.get(r.creator_id as string);
    if (!c) continue; // storefront off or creator missing — hide it.
    items.push({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      priceDollars: Number(r.price ?? 0),
      photo: firstPhoto(r.photos),
      fulfillment: r.fulfillment_type ?? null,
      categories: Array.isArray(r.category_tags) ? r.category_tags : [],
      allergens: Array.isArray(r.allergens) ? r.allergens : [],
      orderCount: Number(r.order_count ?? 0),
      creator: { name: c.name, handle: c.handle, photo: c.photo },
    });
    if (items.length >= args.limit) break;
  }

  const summary = describeFilters(args);
  const forModel =
    items.length === 0
      ? `No live plates matched${summary ? ` (${summary})` : ""}.`
      : `${items.length} plate(s)${summary ? ` matching ${summary}` : ""}:\n` +
        items
          .map(
            (p) =>
              `- ${p.name} ($${p.priceDollars.toFixed(2)}, ${p.fulfillment ?? "?"}, ${p.orderCount} orders) by ${p.creator.handle ? "@" + p.creator.handle : (p.creator.name ?? "a creator")}${p.allergens.length ? ` [allergens: ${p.allergens.join(", ")}]` : ""}`
          )
          .join("\n")
  ;

  return { kind: "plates", items, forModel };
}

// ── Helpers ───────────────────────────────────────────────────────

/** Map creator_id → public profile, ONLY for creators whose storefront is
 *  live. Creators with `storefront_active = false` are omitted so their
 *  plates get filtered out upstream. */
async function loadLiveCreators(
  anon: DB,
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

  const { data: creators } = await anon
    .from("creators")
    .select("id, member_id, storefront_active")
    .in("id", ids)
    .eq("storefront_active", true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorRows = (creators ?? []) as any[];
  if (creatorRows.length === 0) return map;

  const memberIds = creatorRows.map((c) => c.member_id).filter(Boolean);
  const { data: members } = await anon
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

function describeFilters(a: PlateArgs): string {
  const parts: string[] = [];
  if (a.query) parts.push(`"${a.query}"`);
  if (a.minPrice != null && a.maxPrice != null)
    parts.push(`$${a.minPrice}–$${a.maxPrice}`);
  else if (a.minPrice != null) parts.push(`≥$${a.minPrice}`);
  else if (a.maxPrice != null) parts.push(`≤$${a.maxPrice}`);
  if (a.fulfillmentType) parts.push(a.fulfillmentType);
  if (a.category) parts.push(`#${a.category}`);
  if (a.minOrders != null) parts.push(`≥${a.minOrders} orders`);
  return parts.join(", ");
}

/** Strip characters that would break a PostgREST `.or(...)` filter. */
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
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(20, Math.floor(n)));
}
