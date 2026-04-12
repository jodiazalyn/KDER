import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const _body = await request.json();
    // TODO: Stripe Connect Express onboarding + KYC
    return apiSuccess({ onboarding_url: "", creator_id: "" });
  } catch {
    return apiError("Creator onboarding failed", 500);
  }
}
