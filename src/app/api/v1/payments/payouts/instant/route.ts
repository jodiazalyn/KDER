import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const _body = await request.json();
    // TODO: Stripe Connect Instant Payout (1% fee disclosed)
    return apiSuccess({ payout_id: "" });
  } catch {
    return apiError("Instant payout failed", 500);
  }
}
