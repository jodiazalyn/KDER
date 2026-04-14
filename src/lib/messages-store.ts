import type { Message } from "@/types";

const STORAGE_KEY = "kder_messages";
const SEEDED_KEY = "kder_messages_seeded";

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

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getMessages(): Message[] {
  if (typeof window === "undefined") return [];
  seedDemoMessagesIfNeeded();
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getThreadMessages(
  partnerId: string,
  currentUserId: string,
  orderId?: string | null
): Message[] {
  return getMessages()
    .filter((m) => {
      const isThread =
        (m.sender_id === currentUserId && m.recipient_id === partnerId) ||
        (m.sender_id === partnerId && m.recipient_id === currentUserId);
      if (orderId) return isThread && m.order_id === orderId;
      return isThread && !m.order_id;
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

export function getConversations(currentUserId: string): {
  general: Conversation[];
  orders: Conversation[];
} {
  const messages = getMessages();
  const threadMap = new Map<string, Message[]>();

  for (const msg of messages) {
    const partnerId =
      msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id;
    const key = msg.order_id
      ? `order_${msg.order_id}_${partnerId}`
      : `general_${partnerId}`;

    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(msg);
  }

  const general: Conversation[] = [];
  const orders: Conversation[] = [];

  const demoNames: Record<string, string> = {
    member_demo_1: "Marcus J.",
    member_demo_2: "Tasha R.",
    member_demo_3: "Devon W.",
    member_general_1: "Keisha M.",
    member_general_2: "Andre T.",
  };

  for (const [key, msgs] of threadMap) {
    const sorted = msgs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const last = sorted[0];
    const partnerId =
      last.sender_id === currentUserId ? last.recipient_id : last.sender_id;
    const unread = sorted.filter(
      (m) => m.recipient_id === currentUserId && !m.read_at
    ).length;

    const conv: Conversation = {
      threadId: key,
      partnerId,
      partnerName: demoNames[partnerId] || `Member ${partnerId.slice(-4)}`,
      partnerPhoto: null,
      lastMessage: last.body,
      lastMessageAt: last.created_at,
      unreadCount: unread,
      orderId: last.order_id,
    };

    if (key.startsWith("order_")) {
      orders.push(conv);
    } else {
      general.push(conv);
    }
  }

  return { general, orders };
}

export function sendMessage(
  senderId: string,
  recipientId: string,
  body: string,
  orderId?: string | null
): Message {
  const messages = getMessages();
  const msg: Message = {
    id: generateId(),
    order_id: orderId || null,
    sender_id: senderId,
    recipient_id: recipientId,
    body,
    media_url: null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  messages.push(msg);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  return msg;
}

export function markThreadRead(
  partnerId: string,
  currentUserId: string,
  orderId?: string | null
) {
  const messages = getMessages();
  const now = new Date().toISOString();
  let changed = false;

  for (const msg of messages) {
    if (
      msg.recipient_id === currentUserId &&
      msg.sender_id === partnerId &&
      !msg.read_at
    ) {
      if (orderId && msg.order_id !== orderId) continue;
      if (!orderId && msg.order_id) continue;
      msg.read_at = now;
      changed = true;
    }
  }

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }
}

function seedDemoMessagesIfNeeded() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;

  const now = new Date();
  const creatorId = "demo_creator";

  const messages: Message[] = [
    // General conversation 1 — Keisha asking about catering
    {
      id: generateId(),
      order_id: null,
      sender_id: "member_general_1",
      recipient_id: creatorId,
      body: "Hey! Do you do catering for events? I have a birthday party coming up",
      media_url: null,
      read_at: null,
      created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
    },
    {
      id: generateId(),
      order_id: null,
      sender_id: "member_general_1",
      recipient_id: creatorId,
      body: "It would be for about 25 people. Mostly your brisket plates",
      media_url: null,
      read_at: null,
      created_at: new Date(now.getTime() - 44 * 60000).toISOString(),
    },
    // General conversation 2 — Andre asking about hours
    {
      id: generateId(),
      order_id: null,
      sender_id: "member_general_2",
      recipient_id: creatorId,
      body: "What time do you usually have plates ready on weekends?",
      media_url: null,
      read_at: new Date(now.getTime() - 100 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 120 * 60000).toISOString(),
    },
    {
      id: generateId(),
      order_id: null,
      sender_id: creatorId,
      recipient_id: "member_general_2",
      body: "Usually by 11am on Saturdays! Follow my page for updates",
      media_url: null,
      read_at: new Date(now.getTime() - 90 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 95 * 60000).toISOString(),
    },
    // Order thread messages — linked to demo orders
    {
      id: generateId(),
      order_id: "order_demo_1",
      sender_id: "member_demo_1",
      recipient_id: creatorId,
      body: "Hey! Can I pick up my order around 6pm?",
      media_url: null,
      read_at: null,
      created_at: new Date(now.getTime() - 30 * 60000).toISOString(),
    },
    {
      id: generateId(),
      order_id: "order_demo_1",
      sender_id: creatorId,
      recipient_id: "member_demo_1",
      body: "Yes! I'll have it ready by 5:45. See you then 🙌",
      media_url: null,
      read_at: new Date(now.getTime() - 25 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 28 * 60000).toISOString(),
    },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  localStorage.setItem(SEEDED_KEY, "true");
}
