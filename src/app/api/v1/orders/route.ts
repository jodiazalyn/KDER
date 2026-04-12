import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.terms_accepted) return apiError("Terms must be accepted", 400);
    // TODO: Create order + Stripe payment intent
    return apiSuccess({ order_id: "" });
  } catch {
    return apiError("Failed to place order", 500);
  }
}
