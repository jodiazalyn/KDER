"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  display_name: string;
  handle: string;
  photo_url: string | null;
}

/**
 * Returns the current authenticated user.
 * In demo mode: reads from sessionStorage (set during onboarding).
 * In production: would read from Supabase auth session.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Demo mode: build user from onboarding sessionStorage
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
    });

    // TODO: In production, replace with:
    // const supabase = createClient();
    // const { data: { user } } = await supabase.auth.getUser();
    // Fetch profile from members table using user.id

    return () => cancelAnimationFrame(frame);
  }, []);

  return user;
}
