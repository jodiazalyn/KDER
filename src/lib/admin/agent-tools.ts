import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tools for the Super Dashboard "Ask-the-data" analyst.
 *
 * The agent (admin-gated, server-side) orchestrates *which* searches to
 * run; these functions do the deterministic Supabase reads against the
 * service-role client and return presentation-ready cards. The cards are
 * streamed straight to the cofounder's screen — they come from real query
 * results, never from model-guessed ids — while a slim text projection
 * (`forModel`) is fed back to the model so it can narrate accurately
 * without burning tokens on photo URLs and ids.
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
  joinedAt: string;
  /** Public storefront path when the creator has a handle. */
  storefrontPath: string | null;
}

export type ToolResult =
  | { kind: "plates"; items: PlateCard[]; forModel: string }
  | { kind: "creators"; items: CreatorCard[]; forModel: string };

// ── Tool schemas handed to the model ──────────────────────────────

export const ADMIN_AGENT_TOOLS = [
  {
    name: "search_plates",
    description:
      "Search plates/listings by free text (matches plate name and description). Use this whenever the cofounder asks about food, dishes, or plates — e.g. 'creators who have spaghetti meals', 'show me vegan plates', 'who sells tacos'. Returns matching plates with the creator who owns each one.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text search over plate name + description, e.g. 'spaghetti', 'vegan', 'jerk chicken'. Keep it to the key food terms.",
        },
        status: {
          type: "string",
          description:
            "Optional exact listing status filter, e.g. 'active', 'paused', 'draft'. Omit to include all statuses.",
        },
        limit: {
          type: "number",
          description: "Max results (default 12, max 30).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_creators",
    description:
      "Search creators by name, @handle, or bio. Use for 'find creator @joe', 'creators in their bio mention BBQ', or to list recent creators (omit query). Returns creator cards with KYC, storefront, rating, and listing counts.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text over display name, handle, and bio. Omit to list the most recent creators.",
        },
        onlyNeedsAttention: {
          type: "boolean",
          description:
            "When true, return only creators that need a nudge: KYC not verified, storefront off, or zero listings.",
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
        query: str(input.query),
        status: optStr(input.status),
        limit: clampLimit(input.limit),
      });
    case "search_creators":
      return searchCreators(service, {
        query: optStr(input.query),
        onlyNeedsAttention: input.onlyNeedsAttention === true,
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

async function searchPlates(
  service: DB,
  args: { query: string; status?: string; limit: number }
): Promise<ToolResult> {
  const term = sanitize(args.query);

  let q = service
    .from("listings")
    .select(
      "id, creator_id, name, description, price, photos, status, fulfillment_type, category_tags, order_count"
    )
    .order("order_count", { ascending: false })
    .limit(args.limit);

  if (term) {
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (args.status) {
    q = q.eq("status", args.status);
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
      orderCount: Number(r.order_count ?? 0),
      creator: {
        id: r.creator_id,
        name: c?.name ?? null,
        handle: c?.handle ?? null,
        photo: c?.photo ?? null,
      },
    };
  });

  const forModel =
    items.length === 0
      ? `No plates matched "${args.query}".`
      : items
          .map(
            (p) =>
              `- ${p.name} ($${p.priceDollars.toFixed(2)}, ${p.status ?? "?"}, ${p.orderCount} orders) by ${p.creator.handle ? "@" + p.creator.handle : p.creator.name ?? "unknown"}`
          )
          .join("\n");

  return { kind: "plates", items, forModel };
}

// ── search_creators ───────────────────────────────────────────────

async function searchCreators(
  service: DB,
  args: { query?: string; onlyNeedsAttention: boolean; limit: number }
): Promise<ToolResult> {
  const term = args.query ? sanitize(args.query) : "";

  let mq = service
    .from("members")
    .select("id, display_name, handle, photo_url, bio, created_at")
    .eq("role", "creator")
    .limit(args.limit);

  if (term) {
    mq = mq.or(
      `display_name.ilike.%${term}%,handle.ilike.%${term}%,bio.ilike.%${term}%`
    );
  } else {
    mq = mq.order("created_at", { ascending: false });
  }

  const { data: members, error } = await mq;
  if (error) {
    return {
      kind: "creators",
      items: [],
      forModel: `search_creators failed: ${error.message}`,
    };
  }

  const items = await assembleCreatorCards(
    service,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (members ?? []) as any[]
  );

  const filtered = args.onlyNeedsAttention
    ? items.filter(
        (c) =>
          c.kyc !== "verified" ||
          !c.storefrontActive ||
          c.listingCount === 0
      )
    : items;

  const forModel =
    filtered.length === 0
      ? args.query
        ? `No creators matched "${args.query}".`
        : "No creators found."
      : filtered
          .map(
            (c) =>
              `- ${c.name ?? "?"} ${c.handle ? "(@" + c.handle + ")" : ""}: KYC ${c.kyc ?? "?"}, storefront ${c.storefrontActive ? "on" : "off"}, ${c.listingCount} listings (${c.activeListingCount} active), rating ${c.rating ?? "—"}`
          )
          .join("\n");

  return { kind: "creators", items: filtered, forModel };
}

// ── get_creator ───────────────────────────────────────────────────

async function getCreator(
  service: DB,
  args: { handle?: string; id?: string }
): Promise<ToolResult> {
  // Resolve to a member row first (handle lives on members).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let memberRow: any = null;

  if (args.handle) {
    const h = args.handle.replace(/^@/, "").trim();
    const { data } = await service
      .from("members")
      .select("id, display_name, handle, photo_url, bio, created_at")
      .ilike("handle", h)
      .eq("role", "creator")
      .maybeSingle();
    memberRow = data;
  } else if (args.id) {
    const { data: cr } = await service
      .from("creators")
      .select("member_id")
      .eq("id", args.id)
      .maybeSingle();
    if (cr?.member_id) {
      const { data } = await service
        .from("members")
        .select("id, display_name, handle, photo_url, bio, created_at")
        .eq("id", cr.member_id)
        .maybeSingle();
      memberRow = data;
    }
  }

  if (!memberRow) {
    return {
      kind: "creators",
      items: [],
      forModel: `No creator found for ${args.handle ?? args.id ?? "(no identifier)"}.`,
    };
  }

  const cards = await assembleCreatorCards(service, [memberRow]);
  const forModel =
    cards.length === 0
      ? "Creator record incomplete."
      : `Creator @${cards[0].handle ?? "?"} — ${cards[0].listingCount} listings, KYC ${cards[0].kyc ?? "?"}, storefront ${cards[0].storefrontActive ? "on" : "off"}.`;

  return { kind: "creators", items: cards, forModel };
}

// ── Shared assembly helpers ───────────────────────────────────────

/** Map creator_id → { name, handle, photo } via creators→members. */
async function loadCreatorMembers(
  service: DB,
  creatorIds: string[]
): Promise<Map<string, { name: string | null; handle: string | null; photo: string | null }>> {
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

/** Turn member rows (role=creator) into full CreatorCards with creator
 *  metadata + listing counts. */
async function assembleCreatorCards(
  service: DB,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[]
): Promise<CreatorCard[]> {
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.id);

  const { data: creators } = await service
    .from("creators")
    .select(
      "id, member_id, kyc_status, storefront_active, review_rating_avg, review_count, created_at"
    )
    .in("member_id", memberIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorRows = (creators ?? []) as any[];
  const creatorByMember = new Map<string, (typeof creatorRows)[number]>(
    creatorRows.map((c) => [c.member_id, c])
  );

  // Listing counts per creator.
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
  for (const m of members) {
    const c = creatorByMember.get(m.id);
    if (!c) continue; // member flagged creator but no creators row yet
    cards.push({
      id: c.id,
      memberId: m.id,
      name: m.display_name ?? null,
      handle: m.handle ?? null,
      photo: m.photo_url ?? null,
      bio: m.bio ?? null,
      kyc: c.kyc_status ?? null,
      storefrontActive: c.storefront_active === true,
      rating: c.review_rating_avg ?? null,
      reviewCount: Number(c.review_count ?? 0),
      listingCount: listingCount.get(c.id) ?? 0,
      activeListingCount: activeCount.get(c.id) ?? 0,
      joinedAt: m.created_at,
      storefrontPath: m.handle ? `/${m.handle}` : null,
    });
  }
  return cards;
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

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function clampLimit(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(30, Math.floor(n)));
}
