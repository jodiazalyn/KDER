import { getOrders } from "./orders-store";
import type { Order } from "@/types";

export interface Transaction {
  id: string;
  date: string;
  plateName: string;
  memberName: string;
  orderTotal: number;
  platformFee: number;
  netPayout: number;
  status: "paid" | "pending" | "held";
}

export interface EarningsSummary {
  availableBalance: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  transactions: Transaction[];
}

function orderToTransaction(order: Order): Transaction {
  return {
    id: order.id,
    date: order.created_at,
    plateName: order.listing_name,
    memberName: order.member_name,
    orderTotal: order.total_amount,
    platformFee: order.platform_fee,
    netPayout: order.creator_payout,
    status: order.status === "completed" ? "paid" : "held",
  };
}

export function getEarnings(): EarningsSummary {
  const orders = getOrders();
  const completed = orders.filter((o) => o.status === "completed");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const allTime = completed.reduce((sum, o) => sum + o.creator_payout, 0);

  const thisWeek = completed
    .filter((o) => new Date(o.created_at) >= weekAgo)
    .reduce((sum, o) => sum + o.creator_payout, 0);

  const thisMonth = completed
    .filter((o) => new Date(o.created_at) >= monthAgo)
    .reduce((sum, o) => sum + o.creator_payout, 0);

  const transactions = completed
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map(orderToTransaction);

  return {
    availableBalance: allTime,
    thisWeek,
    thisMonth,
    allTime,
    transactions,
  };
}
