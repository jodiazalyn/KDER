import { PricingAgentClient } from "./pricing-agent-client";

export const dynamic = "force-dynamic";

/**
 * Server-component shell for the pricing-coach agent.
 *
 * Reads the auth state up-front so the client knows whether to
 * render the "save this chat" gate (anon) or the past-chats drawer
 * affordance (authed). No DB fetches here — the past-chats list is
 * loaded lazily when the drawer opens.
 */
export default async function PricingAgentPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PricingAgentClient isAuthed={!!user} />;
}
