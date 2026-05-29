import { requireCreator } from "@/lib/loaders/auth";
import { loadCreatorOrders } from "@/lib/loaders/orders";
import { OrdersClient } from "./orders-client";

// Per-creator orders inbox. router.refresh on every mutation +
// 15s poll keeps it fresh. force-dynamic since the data is tied
// to the auth user.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { supabase, user, creator } = await requireCreator();

  // Pull the creator's handle in parallel so the empty-state CTA
  // ("share your link to get your first order") doesn't need a
  // separate client-side fetch.
  const [ordersRes, memberRes] = await Promise.all([
    loadCreatorOrders(supabase, creator.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("members")
      .select("handle")
      .eq("id", user.id)
      .single() as Promise<{ data: { handle: string } | null }>,
  ]);

  const handle = memberRes.data?.handle ?? "mystore";

  return <OrdersClient initialOrders={ordersRes.data} handle={handle} />;
}
