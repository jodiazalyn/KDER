import { getOrders } from "./orders-store";
import type { Order } from "@/types";

const PAYOUTS_KEY = "kder_payouts";

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

export interface PayoutRecord {
  id: string;
  amount: number;
  type: "standard" | "instant";
  fee: number;
  created_at: string;
}

export interface EarningsSummary {
  availableBalance: number;
  totalPaidOut: number;
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

export function getPayouts(): PayoutRecord[] {
  try {
    const raw = localStorage.getItem(PAYOUTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPayout(
  amount: number,
  type: "standard" | "instant",
  fee: number
): PayoutRecord {
  const payouts = getPayouts();
  const record: PayoutRecord = {
    id: `payout_${Date.now()}`,
    amount,
    type,
    fee,
    created_at: new Date().toISOString(),
  };
  payouts.push(record);
  try {
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(payouts));
  } catch {
    // localStorage full or unavailable
  }
  return record;
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

  // Subtract payouts from available balance
  const payouts = getPayouts();
  const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
  const availableBalance = Math.max(0, allTime - totalPaidOut);

  const transactions = completed
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map(orderToTransaction);

  return {
    availableBalance,
    totalPaidOut,
    thisWeek,
    thisMonth,
    allTime,
    transactions,
  };
}
