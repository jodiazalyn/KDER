import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One conversation row in the inbox view. Shape is preserved
 * exactly from the previous `/api/v1/messages/conversations`
 * endpoint so the client island can consume the same data
 * without any changes.
 */
export interface ConversationOut {
  threadId: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId: string | null;
  /** True when any message in this thread was inserted by the
   *  catering system (insertCateringThreadMessage). Used by the
   *  inbox to surface a "Catering" pill alongside the existing
   *  "Order" pill so creators know the thread context before
   *  drilling in. Detected via the 📋 prefix the inquiry +
   *  quote routes use. */
  isCatering: boolean;
}

type RawMsg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Load the user's inbox, grouped by thread (partner + optional
 * order_id). Used by both the GET /api/v1/messages/conversations
 * route and the Server-Component /messages page.
 *
 * Returns `{ general: ConversationOut[], orders: ConversationOut[] }`
 * — the same shape the API has always emitted.
 */
export async function loadConversations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{
  general: ConversationOut[];
  orders: ConversationOut[];
  error: string | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs, error } = (await (supabase as any)
    .from("messages")
    .select("id, sender_id, recipient_id, body, order_id, read_at, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })) as {
    data: RawMsg[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return { general: [], orders: [], error: error.message };
  }
  if (!msgs || msgs.length === 0) {
    return { general: [], orders: [], error: null };
  }

  // Pre-fetch partner profiles in one query
  const partnerIds = Array.from(
    new Set(
      msgs.map((m) => (m.sender_id === userId ? m.recipient_id : m.sender_id))
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partners } = (await (supabase as any)
    .from("members")
    .select("id, display_name, photo_url")
    .in("id", partnerIds)) as {
    data:
      | { id: string; display_name: string; photo_url: string | null }[]
      | null;
  };

  const partnerMap = new Map((partners ?? []).map((p) => [p.id, p]));

  // Group by (partner, order_id?) — keyed on threadId so first-seen
  // (newest) wins for lastMessage + lastMessageAt.
  const byThread = new Map<
    string,
    {
      partnerId: string;
      partnerName: string;
      partnerPhoto: string | null;
      lastMessage: string;
      lastMessageAt: string;
      orderId: string | null;
      unread: number;
      isCatering: boolean;
    }
  >();

  for (const m of msgs) {
    const partnerId =
      m.sender_id === userId ? m.recipient_id : m.sender_id;
    const threadId = m.order_id
      ? `order_${m.order_id}_${partnerId}`
      : `general_${partnerId}`;
    // Catering-system messages from `insertCateringThreadMessage`
    // all start with the 📋 emoji. Cheap pattern match, no false
    // positives expected (regular users don't open chat messages
    // with that emoji).
    const isCateringMessage = m.body.startsWith("📋");

    let thread = byThread.get(threadId);
    if (!thread) {
      const partner = partnerMap.get(partnerId);
      thread = {
        partnerId,
        partnerName: partner?.display_name || "Unknown",
        partnerPhoto: partner?.photo_url ?? null,
        lastMessage: m.body,
        lastMessageAt: m.created_at,
        orderId: m.order_id,
        unread: 0,
        isCatering: isCateringMessage,
      };
      byThread.set(threadId, thread);
    } else if (isCateringMessage) {
      // Sticky — once any message in the thread is catering, the
      // whole thread reads as catering-related.
      thread.isCatering = true;
    }
    if (m.recipient_id === userId && !m.read_at) {
      thread.unread += 1;
    }
  }

  const general: ConversationOut[] = [];
  const orders: ConversationOut[] = [];
  for (const [threadId, t] of byThread) {
    const conv: ConversationOut = {
      threadId,
      partnerId: t.partnerId,
      partnerName: t.partnerName,
      partnerPhoto: t.partnerPhoto,
      lastMessage: t.lastMessage,
      lastMessageAt: t.lastMessageAt,
      unreadCount: t.unread,
      orderId: t.orderId,
      isCatering: t.isCatering,
    };
    if (t.orderId) orders.push(conv);
    else general.push(conv);
  }

  return { general, orders, error: null };
}
