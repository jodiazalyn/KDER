"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChefHat,
  Share2,
  Wallet,
  Users,
  ArrowRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;
const HANDLE_DEBOUNCE_MS = 400;

type HandleStatus = "idle" | "checking" | "available" | "taken";

function HandleInput({
  handle,
  onChange,
  status,
  canClaim,
  claiming,
  onClaim,
}: {
  handle: string;
  onChange: (value: string) => void;
  status: HandleStatus;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}) {
  const borderClass =
    status === "available"
      ? "border-green-400/50 shadow-[0_0_24px_rgba(74,222,128,0.15)]"
      : status === "taken"
        ? "border-red-400/50"
        : "border-white/15 focus-within:border-white/40";

  return (
    <div
      className={`mt-8 flex w-full max-w-[520px] flex-col items-stretch gap-2 rounded-[28px] border bg-white/[0.04] p-1.5 backdrop-blur-[12px] transition-colors sm:flex-row sm:items-center sm:rounded-full ${borderClass}`}
    >
      <div className="flex flex-1 items-center gap-1 px-4 py-2 sm:py-0">
        <span className="select-none whitespace-nowrap text-sm font-medium text-white/40">
          kder.club/@
        </span>
        <input
          id="hero-handle"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="yourhandle"
          value={handle}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canClaim) onClaim();
          }}
          aria-describedby="handle-status"
          className="h-12 flex-1 bg-transparent text-base font-medium text-white placeholder:text-white/25 focus:outline-none sm:h-10"
        />
      </div>

      <button
        type="button"
        onClick={onClaim}
        disabled={!canClaim}
        aria-label={
          handle
            ? `Claim handle ${handle}`
            : "Enter a handle to claim"
        }
        className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[#1B5E20] px-6 text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.45)] transition-all enabled:hover:bg-[#207024] enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none sm:h-10 sm:min-w-[120px]"
      >
        {claiming ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            Claim
            <ArrowRight
              size={16}
              className="transition-transform group-enabled:group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>
    </div>
  );
}

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

  // Handle input state
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [claiming, setClaiming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

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

  // Debounced availability check for typed handle
  const checkAvailability = useCallback(async (value: string) => {
    if (!HANDLE_REGEX.test(value)) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    try {
      const res = await fetch(
        `/api/v1/handles/check?handle=${encodeURIComponent(value)}`
      );
      const json = await res.json();
      if (json.data?.available) {
        setHandleStatus("available");
      } else {
        setHandleStatus("taken");
      }
    } catch {
      setHandleStatus("idle");
    }
  }, []);

  const onHandleChange = (raw: string) => {
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    setHandle(sanitized);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!sanitized || sanitized.length < 3) {
      setHandleStatus("idle");
      return;
    }
    debounceRef.current = setTimeout(
      () => checkAvailability(sanitized),
      HANDLE_DEBOUNCE_MS
    );
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const canClaim = handleStatus === "available" && !claiming;

  const handleClaim = () => {
    if (!canClaim) return;
    setClaiming(true);
    try {
      sessionStorage.setItem("kder_onboarding_handle", handle);
    } catch {
      // sessionStorage blocked — still proceed to signup
    }
    router.push("/signup");
  };

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

            <span className="mb-5 inline-block rounded-full border border-green-400/20 bg-green-900/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-300 animate-in fade-in slide-in-from-bottom-2 duration-700">
              A Food Club on KDER
            </span>

            <h1 className="animate-in fade-in slide-in-from-bottom-4 bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-5xl font-black leading-[1.05] tracking-[-0.03em] text-transparent duration-700 lg:text-7xl">
              Your kitchen.
              <br />
              Your club.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:text-lg">
              Claim your club link.{" "}
              <span className="text-green-300">Monetize your kitchen by sharing food.</span>
            </p>

            {/* Handle input — Uber-inspired hero form */}
            <label htmlFor="hero-handle" className="sr-only">
              Your KDER handle
            </label>
            <HandleInput
              handle={handle}
              onChange={onHandleChange}
              status={handleStatus}
              canClaim={canClaim}
              claiming={claiming}
              onClaim={handleClaim}
            />

            {/* Availability status line */}
            <div
              className="mt-3 h-5 text-xs"
              role="status"
              aria-live="polite"
            >
              {handleStatus === "idle" && handle.length > 0 && handle.length < 3 && (
                <span className="text-white/40">
                  3–30 characters · letters, numbers, underscores
                </span>
              )}
              {handleStatus === "checking" && (
                <span className="inline-flex items-center gap-1.5 text-white/50">
                  <Loader2 size={12} className="animate-spin" />
                  Checking availability…
                </span>
              )}
              {handleStatus === "available" && (
                <span className="inline-flex items-center gap-1.5 text-green-400">
                  <Check size={12} />
                  <strong className="font-semibold">@{handle}</strong> is
                  yours. Click claim to continue.
                </span>
              )}
              {handleStatus === "taken" && (
                <span className="inline-flex items-center gap-1.5 text-red-400">
                  <X size={12} />
                  <strong className="font-semibold">@{handle}</strong> is
                  already taken. Try another.
                </span>
              )}
            </div>

            {/* Secondary action */}
            <button
              type="button"
              onClick={scrollToFeatures}
              className="mt-5 text-xs font-medium text-white/50 underline-offset-4 transition-colors hover:text-white/90 hover:underline"
            >
              How KDER works →
            </button>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section
          id="features"
          className="mx-auto max-w-7xl scroll-mt-20 px-6 py-24 lg:py-40"
          aria-labelledby="features-heading"
        >
          <div className="mb-14 max-w-xl lg:mb-20">
            <span className="mb-4 inline-block rounded-full border border-green-400/20 bg-green-900/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-300">
              How it works
            </span>
            <h2
              id="features-heading"
              className="text-3xl font-black leading-tight tracking-[-0.02em] text-white lg:text-5xl"
            >
              Everything you need to grow your food empire.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/60 lg:text-lg">
              No middlemen. No algorithms to fight. Just the tools to sell what
              you make.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-8">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-green-400/20 hover:bg-white/[0.06] sm:flex-row sm:items-center sm:gap-7 lg:p-9"
              >
                {/* Text block */}
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 text-base font-bold text-white lg:text-xl">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/60 lg:text-[15px]">
                    {body}
                  </p>
                </div>

                {/* Visual cue — large icon tile with decorative glow */}
                <div className="relative order-first shrink-0 sm:order-last">
                  {/* Decorative glow behind the tile */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-green-400/20 via-green-500/5 to-transparent blur-xl"
                  />
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-green-400/20 bg-gradient-to-br from-green-900/60 to-green-950/40 text-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform group-hover:scale-105 lg:h-24 lg:w-24">
                    <Icon
                      size={36}
                      strokeWidth={1.75}
                      className="lg:h-11 lg:w-11"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Community CTA ─────────────────────────────────── */}
        <section
          className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:pb-32 lg:pt-12"
          aria-labelledby="community-heading"
        >
          <div className="relative overflow-hidden rounded-3xl border border-green-400/20 bg-gradient-to-br from-[#1B5E20] via-[#164A1A] to-[#0B2F0E] p-10 lg:p-20">
            {/* Background photo — fills the entire card */}
            <Image
              src="/images/community-houston.jpg"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 1280px"
              className="object-cover"
              aria-hidden="true"
            />

            {/* Brand-green color overlay — blends the photo with the KDER palette */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1B5E20]/80 via-[#164A1A]/85 to-[#0B2F0E]/90"
            />

            {/* Left-to-right darkening — guarantees text contrast over any photo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/10"
            />

            {/* Decorative blurred glow (kept for brand continuity) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-green-400/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-green-300/10 blur-3xl"
            />

            <div className="relative z-10 max-w-2xl">
              <span className="mb-5 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                Community Choice
              </span>
              <h2
                id="community-heading"
                className="text-3xl font-black leading-tight tracking-[-0.02em] text-white lg:text-5xl"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
              >
                Built for Houston food creators.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 lg:text-lg">
                Every order on KDER supports a home chef in your community. No
                gatekeepers, no 30% commissions. Join the movement.
              </p>
              <Link
                href="/signup"
                className="mt-10 inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-white px-8 text-sm font-bold text-[#1B5E20] shadow-[0_8px_32px_rgba(255,255,255,0.15)] transition-all hover:shadow-[0_12px_40px_rgba(255,255,255,0.25)] active:scale-95"
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
