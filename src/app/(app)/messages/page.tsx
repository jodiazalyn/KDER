import { requireUser } from "@/lib/loaders/auth";
import { loadConversations } from "@/lib/loaders/conversations";
import { MessagesClient } from "./messages-client";

// Per-user inbox. router.refresh after compose-send re-pulls
// the grouped thread list.
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  // Messages are for everyone (creator + customer), not just
  // creators — use requireUser, not requireCreator.
  const { supabase, user } = await requireUser();
  const { general, orders } = await loadConversations(supabase, user.id);
  return (
    <MessagesClient
      initialGeneral={general}
      initialOrders={orders}
      currentUserId={user.id}
    />
  );
}
