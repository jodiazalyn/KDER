import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/v1/auth/|api/v1/checkout|api/v1/payments/webhook|api/v1/messages/webhook|signup|order-confirmation).*)",
  ],
};
