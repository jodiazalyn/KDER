import { PricingAgentClient } from "./pricing-agent-client";

export const dynamic = "force-dynamic";

/**
 * Server-component shell for the pricing-coach agent.
 *
 * Reads the auth state up-front so the client knows whether to
 * render the "save this chat" gate (anon) or the past-chats drawer
 * affordance (authed). No DB fetches here — the past-chats list is
 * loaded lazily when the drawer opens.
 *
 * Tolerant of missing Supabase env vars (demo-mode dev): when the
 * server client can't be constructed we just render as anon. Matches
 * the pattern used by the landing page (src/app/page.tsx) for the
 * same reason.
 */
export default async function PricingAgentPage() {
  let isAuthed = false;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = !!user;
  } catch {
    // Supabase not configured — render as anon (the rest of the
    // agent uses localStorage anyway when not authed).
  }

  return <PricingAgentClient isAuthed={isAuthed} />;
}
