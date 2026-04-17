"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChefHat,
  Share2,
  Wallet,
  Users,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FeatureCard = {
  icon: typeof ChefHat;
  title: string;
  body: string;
};

const FEATURES: FeatureCard[] = [
  {
    icon: ChefHat,
    title: "List plates",
    body: "Upload photos, set your price. Publish in 60 seconds.",
  },
  {
    icon: Share2,
    title: "Share your link",
    body: "One URL for Instagram, WhatsApp, and everywhere.",
  },
  {
    icon: Wallet,
    title: "Get paid fast",
    body: "Payouts to your bank in 1 business day. 95% to you.",
  },
  {
    icon: Users,
    title: "Own your audience",
    body: "No algorithm. Your regulars, your data, your community.",
  },
];

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
        // Supabase not configured (demo mode) — show landing
        if (!cancelled) setCheckingSession(false);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Brief loading veil while we check the session — avoids flash of landing
  // for signed-in users who are about to redirect to /dashboard.
  if (checkingSession) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A]">
        <div
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

  const scrollToFeatures = () => {
    document
      .getElementById("features")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* ── Top nav ───────────────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-[24px]"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link
            href="/"
            aria-label="KDER home"
            className="flex items-center gap-2"
          >
            <Image
              src="/icons/kder-logo.png"
              alt=""
              width={28}
              height={28}
              priority
            />
            <span className="text-sm font-black tracking-[0.2em] text-white">
              KDER
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="hidden h-10 items-center rounded-full border border-white/15 px-4 text-xs font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white lg:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-[#1B5E20] px-4 text-xs font-bold text-white shadow-[0_0_18px_rgba(27,94,32,0.45)] transition-transform active:scale-95"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section
          className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6 pt-14 lg:min-h-[82vh]"
          aria-label="Hero"
        >
          {/* Green radial glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(46,125,50,0.35) 0%, transparent 70%)",
            }}
          />
          {/* Subtle grain / vignette */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.6) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
            <div
              className="mb-7"
              style={{ filter: "drop-shadow(0 0 48px rgba(46,125,50,0.55))" }}
            >
              <Image
                src="/icons/kder-logo.png"
                alt="KDER — hospitality sovereignty platform"
                width={120}
                height={120}
                priority
                className="animate-in fade-in zoom-in-75 duration-700"
              />
            </div>

            <h1 className="animate-in fade-in slide-in-from-bottom-4 bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-5xl font-black leading-[1.05] tracking-tight text-transparent duration-700 lg:text-7xl">
              Your kitchen.
              <br />
              Your customers.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:text-lg">
              The sovereign marketplace for Houston food creators.
              <span className="text-green-300"> Keep 95% of every sale.</span>
            </p>

            {/* CTAs */}
            <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[#1B5E20] px-7 text-sm font-bold text-white shadow-[0_0_28px_rgba(27,94,32,0.55)] transition-all hover:bg-[#207024] active:scale-95 sm:min-w-[220px]"
              >
                Start selling — it&apos;s free
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <button
                type="button"
                onClick={scrollToFeatures}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-7 text-sm font-semibold text-white/90 backdrop-blur-[8px] transition-colors hover:border-white/40 hover:bg-white/[0.08] active:scale-95 sm:min-w-[160px]"
              >
                How it works
              </button>
            </div>

            {/* Trust strip */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-green-400" />
                No monthly fees
              </span>
              <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden />
              <span>Paid out in 1 day</span>
              <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden />
              <span>Keep 95%</span>
            </div>
          </div>

          {/* Scroll hint */}
          <button
            type="button"
            onClick={scrollToFeatures}
            aria-label="Scroll to features"
            className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/30 transition-colors hover:text-white/60"
          >
            <div className="flex h-8 w-5 items-start justify-center rounded-full border border-white/20 p-1">
              <span className="block h-1.5 w-0.5 animate-bounce rounded-full bg-white/60" />
            </div>
          </button>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section
          id="features"
          className="mx-auto max-w-7xl scroll-mt-20 px-6 py-20 lg:py-28"
          aria-labelledby="features-heading"
        >
          <div className="mb-10 max-w-xl">
            <span className="mb-3 inline-block rounded-full border border-green-400/20 bg-green-900/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-300">
              How it works
            </span>
            <h2
              id="features-heading"
              className="text-3xl font-black leading-tight text-white lg:text-5xl"
            >
              Everything you need to grow your food empire.
            </h2>
            <p className="mt-3 text-sm text-white/60 lg:text-base">
              No middlemen. No algorithms to fight. Just the tools to sell what
              you make.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-green-400/20 hover:bg-white/[0.06] lg:p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-green-900/40 text-green-300 transition-colors group-hover:bg-green-800/60">
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <h3 className="mb-1.5 text-sm font-bold text-white lg:text-base">
                  {title}
                </h3>
                <p className="text-xs leading-relaxed text-white/60 lg:text-sm">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Community CTA ─────────────────────────────────── */}
        <section
          className="mx-auto max-w-7xl px-6 pb-20"
          aria-labelledby="community-heading"
        >
          <div className="relative overflow-hidden rounded-3xl border border-green-400/20 bg-gradient-to-br from-[#1B5E20] via-[#164A1A] to-[#0B2F0E] p-8 lg:p-14">
            {/* Decorative blurred glow (from inspiration) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-green-400/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-green-300/10 blur-3xl"
            />

            <div className="relative z-10 max-w-2xl">
              <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                Community Choice
              </span>
              <h2
                id="community-heading"
                className="text-3xl font-black leading-tight text-white lg:text-5xl"
              >
                Built for Houston food creators.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 lg:text-lg">
                Every order on KDER supports a home chef in your community. No
                gatekeepers, no 30% commissions. Join the movement.
              </p>
              <Link
                href="/signup"
                className="mt-7 inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-white px-7 text-sm font-bold text-[#1B5E20] shadow-[0_8px_32px_rgba(255,255,255,0.15)] transition-all hover:shadow-[0_12px_40px_rgba(255,255,255,0.25)] active:scale-95"
              >
                Claim your handle
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#050505] px-6 pb-10 pt-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="max-w-md">
              <Link href="/" className="mb-5 inline-flex items-center gap-2">
                <Image
                  src="/icons/kder-logo.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span className="text-sm font-black tracking-[0.2em] text-white">
                  KDER
                </span>
              </Link>
              <p className="text-sm leading-relaxed text-white/50">
                KDER is the sovereign marketplace connecting passionate food
                creators with local customers. Share, discover, and enjoy
                homemade culinary excellence.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/80">
                  For creators
                </h4>
                <ul className="space-y-2.5 text-sm text-white/50">
                  <li>
                    <Link
                      href="/signup"
                      className="transition-colors hover:text-green-300"
                    >
                      Start selling
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={scrollToFeatures}
                      className="transition-colors hover:text-green-300"
                    >
                      How it works
                    </button>
                  </li>
                  <li>
                    <span className="text-white/30">Pricing — always free</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/80">
                  For foodies
                </h4>
                <ul className="space-y-2.5 text-sm text-white/50">
                  <li>
                    <span className="text-white/30">
                      Discover creators — soon
                    </span>
                  </li>
                  <li>
                    <span className="text-white/30">Safe payments</span>
                  </li>
                  <li>
                    <span className="text-white/30">Ratings &amp; reviews</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start gap-3 border-t border-white/[0.05] pt-6 text-[11px] text-white/40 lg:flex-row lg:items-center lg:justify-between">
            <p>
              © {new Date().getFullYear()} KDER. Sovereign hospitality for
              Houston.
            </p>
            <div className="flex gap-5">
              <span className="text-white/30">Privacy</span>
              <span className="text-white/30">Terms</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
