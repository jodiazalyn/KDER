/**
 * Conversation shape used by the creator inbox + row components.
 *
 * This file used to be a localStorage-backed demo store. All data now flows
 * through `/api/v1/messages/conversations` (Supabase-backed). The type is
 * retained here so existing importers (`messages/page.tsx`,
 * `ConversationRow.tsx`) don't break — move to `@/types` if convenient later.
 */
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
