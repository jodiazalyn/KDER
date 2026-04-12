import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // TODO: ready order ${id}
    return apiSuccess({ order_id: id, status: "readyed" });
  } catch {
    return apiError("Failed to ready order", 500);
  }
}
