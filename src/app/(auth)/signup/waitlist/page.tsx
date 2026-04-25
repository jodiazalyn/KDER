"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Loader2, Phone } from "lucide-react";

/**
 * Brand-mark SVGs inlined because the project's lucide-react@1.8.0
 * predates Lucide's icon rebrand and doesn't ship Facebook / Instagram
 * exports. Paths are from Simple Icons (CC0). Keeps the page
 * self-contained and avoids upgrading lucide across the whole app.
 */
function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  );
}

/**
 * Membership-pending landing — shown when a creator (or customer) hits
 * `sms_send_failed` from /api/v1/auth/request-otp because A2P 10DLC
 * registration is still pending. We never expose that detail to them;
 * the page reframes the moment as "KDER is a private club, we're
 * reviewing your account."
 *
 * For creators, the handle they typed on the landing page (stored in
 * sessionStorage as `kder_onboarding_handle`) auto-reserves to their
 * phone via /api/v1/beta/waitlist on mount, so the handle is locked
 * to them while the operator manually onboards them via Supabase's
 * test-number list.
 */

// TODO: replace with real KDER social URLs when Jodi provides them.
// Until then these are clearly placeholder. Search/replace these two
// constants with the live URLs (Facebook page + Instagram profile).
const KDER_FACEBOOK_URL = "https://www.facebook.com/kder";
const KDER_INSTAGRAM_URL = "https://www.instagram.com/kder";

type ReserveState =
  | { kind: "idle" }
  | { kind: "reserving" }
  | { kind: "reserved"; handle: string }
  | { kind: "no-handle" }
  // Errors are still tracked internally for server-side logging, but
  // intentionally NOT rendered — the user shouldn't see "couldn't save
  // your spot" since the private-club framing implies active review.
  | { kind: "error"; message: string };

function WaitlistInner() {
  const [phone, setPhone] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [reserve, setReserve] = useState<ReserveState>({ kind: "idle" });
  // Guard against StrictMode double-fire in dev.
  const reservedOnceRef = useRef(false);

  useEffect(() => {
    // Defer setState via setTimeout(0) to satisfy React 19's
    // react-hooks/set-state-in-effect rule.
    const id = setTimeout(() => {
      const storedPhone = sessionStorage.getItem("kder_signup_phone");
      const storedMode = sessionStorage.getItem("kder_signup_mode");
      const storedHandle = sessionStorage.getItem("kder_onboarding_handle");
      setPhone(storedPhone);
      setMode(storedMode);

      const isCreator = storedMode !== "customer";
      if (!isCreator) return;
      if (!storedPhone || !storedHandle) {
        setReserve({ kind: "no-handle" });
        return;
      }
      if (reservedOnceRef.current) return;
      reservedOnceRef.current = true;
      reserveHandle(storedPhone, storedHandle);
    }, 0);
    return () => clearTimeout(id);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reserveHandle(phoneE164: string, rawHandle: string) {
    setReserve({ kind: "reserving" });
    try {
      const res = await fetch("/api/v1/beta/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          mode: "creator",
          handle: rawHandle,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Track silently — useful for server-side debugging via the
        // notifier email + console.error in the API route. We do NOT
        // surface this to the user; the private-club framing is that
        // we're reviewing them, not that something failed.
        setReserve({
          kind: "error",
          message: json.error || "reserve failed",
        });
        return;
      }
      const reservedHandle = json.data?.handle ?? rawHandle.toLowerCase();
      setReserve({ kind: "reserved", handle: reservedHandle });
    } catch {
      setReserve({ kind: "error", message: "network error" });
    }
  }

  const tail = phone ? phone.slice(-4) : null;
  const display = phone
    ? phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
    : null;
  const isCreator = mode !== "customer";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between px-6 py-12 bg-[#0A0A0A]">
      {/* Green radial glow — same vibe as /signup */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(46,125,50,0.12) 0%, transparent 65%)",
        }}
      />

      {/* Top — logo + lockup */}
      <div className="relative z-10 flex flex-col items-center pt-12">
        <Image
          src="/icons/kder-logo.png"
          alt="KDER"
          width={100}
          height={100}
          priority
          style={{ filter: "drop-shadow(0 0 30px rgba(46,125,50,0.4))" }}
        />
        <h1
          className="mt-4 text-4xl font-black tracking-widest text-white"
          style={{ filter: "drop-shadow(0 0 30px rgba(46,125,50,0.5))" }}
        >
          KDER
        </h1>
      </div>

      {/* Center — message */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-400/30 bg-green-900/30 backdrop-blur-[8px]">
          <Check size={28} className="text-green-300" />
        </div>

        <h2 className="text-2xl font-black text-white">
          We&apos;re reviewing your account
        </h2>

        <p className="text-base text-white/70">
          KDER is a private club for Houston home cooks and the people who
          love them. We&apos;re approving new members by hand. Drop us a DM
          on Facebook or Instagram to fast-track your spot.
        </p>

        {tail && (
          <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm text-white/80">
            <Phone size={14} className="text-white/50" />
            Got your number — {display || `…${tail}`}
          </div>
        )}

        {/* Creator-only handle reservation status. The "reserving" state
            is transient (sub-second). The "reserved" state confirms the
            handle is locked to their phone for when access opens.
            The "error" state intentionally renders nothing — see the
            ReserveState type comment above. */}
        {isCreator && reserve.kind === "reserving" && (
          <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm text-white/70">
            <Loader2 size={14} className="animate-spin text-white/60" />
            Locking in your handle…
          </div>
        )}
        {isCreator && reserve.kind === "reserved" && (
          <div className="flex items-center gap-2 rounded-full border border-green-400/30 bg-green-900/30 px-4 py-2 text-sm text-green-200">
            <Check size={14} />
            @{reserve.handle} is yours when you get access
          </div>
        )}

        {/* Social CTA — sized like a chunky touch target since these
            are the primary call-to-action below the message. */}
        <div className="mt-2 flex flex-col items-center gap-3">
          <p className="text-xs uppercase tracking-wider text-white/40">
            DM us
          </p>
          <div className="flex items-center gap-3">
            <a
              href={KDER_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DM KDER on Facebook"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.06] text-white/85 transition-all hover:border-blue-400/40 hover:bg-blue-900/30 hover:text-blue-300 active:scale-90"
            >
              <FacebookIcon />
            </a>
            <a
              href={KDER_INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DM KDER on Instagram"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.06] text-white/85 transition-all hover:border-pink-400/40 hover:bg-pink-900/20 hover:text-pink-300 active:scale-90"
            >
              <InstagramIcon />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom — back home */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-3 pb-4">
        <Link
          href="/"
          className="flex h-14 w-full items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.06] text-base font-semibold text-white/90 backdrop-blur-[8px] transition-all active:scale-95 hover:bg-white/[0.1]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={null}>
      <WaitlistInner />
    </Suspense>
  );
}
