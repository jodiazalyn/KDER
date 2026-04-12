import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const _body = await request.json();
    // TODO: Parse SMS ACCEPT/DECLINE keyword, update order
    return apiSuccess({ processed: true });
  } catch {
    return apiError("Failed to process SMS action", 500);
  }
}
