import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function apiSuccess<T>(data: T, meta?: ApiResponse<T>["meta"]) {
  const response: ApiResponse<T> = { data, error: null, meta };
  return NextResponse.json(response);
}

export function apiError(
  error: string,
  status: number = 400,
  extras?: Record<string, unknown>
) {
  const response: ApiResponse<never> = { data: null, error };
  return NextResponse.json({ ...response, ...extras }, { status });
}
