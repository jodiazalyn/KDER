import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const { zip_code } = await request.json();
    if (!zip_code) return apiError("Zip code is required", 400);
    // TODO: Validate Houston zip + resolve neighborhood
    return apiSuccess({ zip_code, neighborhood: "" });
  } catch {
    return apiError("Failed to add zip code", 500);
  }
}
