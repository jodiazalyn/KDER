"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CurrentUser {
  id: string;
  display_name: string;
  handle: string;
  photo_url: string | null;
}

/**
 * Returns the current authenticated user.
 * Tries Supabase auth first, falls back to sessionStorage for onboarding flow.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      // Try Supabase auth first
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser && !cancelled) {
          // Fetch profile from members table
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: member } = await (supabase as any)
            .from("members")
            .select("id, display_name, handle, photo_url")
            .eq("id", authUser.id)
            .single();

          if (member && !cancelled) {
            const m = member as { id: string; display_name: string; handle: string | null; photo_url: string | null };
            setUser({
              id: m.id,
              display_name: m.display_name,
              handle: m.handle || "mystore",
              photo_url: m.photo_url,
            });
            return;
          }

          // Auth user exists but no member row yet (mid-onboarding)
          if (!cancelled) {
            const profileRaw =
              sessionStorage.getItem("kder_onboarding_profile");
            const handle = sessionStorage.getItem("kder_onboarding_handle");
            const profile = profileRaw ? JSON.parse(profileRaw) : {};
            setUser({
              id: authUser.id,
              display_name: profile.display_name || "Creator",
              handle: handle || "mystore",
              photo_url: profile.photo_url || null,
            });
            return;
          }
        }
      } catch {
        // Supabase not available, fall through to demo
      }

      // Fallback: sessionStorage demo mode
      if (!cancelled) {
        const profileRaw = sessionStorage.getItem("kder_onboarding_profile");
        const handle = sessionStorage.getItem("kder_onboarding_handle");

        if (profileRaw || handle) {
          const profile = profileRaw ? JSON.parse(profileRaw) : {};
          setUser({
            id: "demo_creator",
            display_name: profile.display_name || "Creator",
            handle: handle || "mystore",
            photo_url: profile.photo_url || null,
          });
        } else {
          setUser({
            id: "demo_creator",
            display_name: "Creator",
            handle: "mystore",
            photo_url: null,
          });
        }
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
