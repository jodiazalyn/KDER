import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const _body = await request.json();
    // TODO: Submit Vibe Engine rating
    return apiSuccess({ rating_id: "" });
  } catch {
    return apiError("Failed to submit rating", 500);
  }
}
