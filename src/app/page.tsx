"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { BuiltForHouston } from "@/components/landing/BuiltForHouston";
import { CreatorProgram } from "@/components/landing/CreatorProgram";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ListingShowcase } from "@/components/landing/ListingShowcase";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { MissionAnchor } from "@/components/landing/MissionAnchor";
import { PayoutShowcase } from "@/components/landing/PayoutShowcase";
import { Testimonials } from "@/components/landing/Testimonials";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { WaitlistCTA } from "@/components/landing/WaitlistCTA";

/**
 * KDER public landing page.
 *
 * The page itself is a thin client component (only client-side because
 * of the auth-redirect effect — signed-in visitors bounce to
 * `/dashboard` before they ever see the marketing surface). The
 * actual marketing content is composed of stateless section
 * components living in `src/components/landing/`. Edit a section in
 * its own file; this file should rarely change.
 *
 * Theme: light (cream + paper) — deliberate contrast against the
 * dark in-app experience. See:
 *  - `tailwind.config.ts` for the kder-cream / kder-ink / kder-mint
 *    tokens
 *  - `src/components/landing/Hero.tsx` for the hero + phone mockup
 *    composition
 *
 * NOTE re viewport theme color: Next 15 supports per-page `viewport`
 * exports BUT this page is "use client" because of the auth redirect,
 * which means the `viewport` export must be in a server boundary.
 * The dark `themeColor` set in `layout.tsx` (`#0A0A0A`) is a
 * cosmetic mismatch on iOS Safari's address bar for this one page.
 * Tradeoff accepted to keep the auth redirect simple — a follow-up
 * could split the marketing surface into a server component shell
 * with the redirect handled via middleware.
 */
export default function LandingPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          router.replace("/dashboard");
          return;
        }
        setCheckingSession(false);
      } catch {
        // Supabase not configured (demo mode) — show landing.
        if (!cancelled) setCheckingSession(false);
      }
    };
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Brief loading veil while we check the session — avoids a flash of
  // the marketing page for signed-in users about to redirect to
  // /dashboard. Stays dark to match the in-app surface they're about
  // to land on, smoothing the cream→dark transition.
  if (checkingSession) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(46,125,50,0.25) 0%, transparent 65%)",
          }}
        />
        <Image
          src="/icons/kder-logo.png"
          alt="KDER"
          width={96}
          height={96}
          priority
          className="animate-pulse"
          style={{ filter: "drop-shadow(0 0 32px rgba(46,125,50,0.6))" }}
        />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-kder-cream text-kder-ink">
      <MarketingNav />
      <main>
        <Hero />
        <MissionAnchor />
        <TrustStrip />
        <HowItWorks />
        <ListingShowcase />
        <CreatorProgram />
        <PayoutShowcase />
        <BuiltForHouston />
        <Testimonials />
        <WaitlistCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
