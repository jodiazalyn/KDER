import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // TODO: decline order ${id}
    return apiSuccess({ order_id: id, status: "declineed" });
  } catch {
    return apiError("Failed to decline order", 500);
  }
}
