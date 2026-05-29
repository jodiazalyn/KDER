import { requireCreator } from "@/lib/loaders/auth";
import { loadCreatorOrders } from "@/lib/loaders/orders";
import { loadCateringInflight } from "@/lib/loaders/catering-inflight";
import { OrdersClient } from "./orders-client";

// Per-creator orders inbox. router.refresh on every mutation +
// 15s poll keeps it fresh. force-dynamic since the data is tied
// to the auth user.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { supabase, user, creator } = await requireCreator();

  // Three independent fetches in parallel. The catering-inflight
  // loader replaces the old self-fetching CateringInquiryBanner —
  // its data is now part of the same RSC payload + refreshes on
  // the 15s polling tick along with orders.
  const [ordersRes, memberRes, cateringInflight] = await Promise.all([
    loadCreatorOrders(supabase, creator.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("members")
      .select("handle")
      .eq("id", user.id)
      .single() as Promise<{ data: { handle: string } | null }>,
    loadCateringInflight(supabase, creator.id),
  ]);

  const handle = memberRes.data?.handle ?? "mystore";

  return (
    <OrdersClient
      initialOrders={ordersRes.data}
      handle={handle}
      cateringInflight={cateringInflight}
    />
  );
}
