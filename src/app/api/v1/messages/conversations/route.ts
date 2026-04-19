import { apiSuccess, apiError } from "@/lib/api";

type RawMsg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

export interface ConversationOut {
  threadId: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId: string | null;
}

/**
 * GET /api/v1/messages/conversations — grouped thread list for the current user.
 *
 * Returns `{ general: Conversation[], orders: Conversation[] }` shaped to match
 * the old messages-store API so the creator inbox page needs only a data-source
 * swap, not a UI rewrite.
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized.", 401);

    // All messages involving me, newest first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgs, error } = (await (supabase as any)
      .from("messages")
      .select("id, sender_id, recipient_id, body, order_id, read_at, created_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })) as {
      data: RawMsg[] | null;
      error: { message: string } | null;
    };

    if (error) return apiError("Failed to fetch conversations.", 500);
    if (!msgs || msgs.length === 0) {
      return apiSuccess({ general: [], orders: [] });
    }

    // Pre-fetch partner profiles in one query
    const partnerIds = Array.from(
      new Set(
        msgs.map((m) => (m.sender_id === user.id ? m.recipient_id : m.sender_id))
      )
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: partners } = (await (supabase as any)
      .from("members")
      .select("id, display_name, photo_url")
      .in("id", partnerIds)) as {
      data: { id: string; display_name: string; photo_url: string | null }[] | null;
    };

    const partnerMap = new Map(
      (partners ?? []).map((p) => [p.id, p])
    );

    // Group by (partner, order_id?) — keyed on threadId so first-seen (newest) wins
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
      }
    >();

    for (const m of msgs) {
      const partnerId =
        m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const threadId = m.order_id
        ? `order_${m.order_id}_${partnerId}`
        : `general_${partnerId}`;

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
        };
        byThread.set(threadId, thread);
      }
      // Count unread — messages FROM partner that I haven't read yet
      if (m.recipient_id === user.id && !m.read_at) {
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
      };
      if (t.orderId) orders.push(conv);
      else general.push(conv);
    }

    return apiSuccess({ general, orders });
  } catch {
    return apiError("Failed to fetch conversations.", 500);
  }
}
