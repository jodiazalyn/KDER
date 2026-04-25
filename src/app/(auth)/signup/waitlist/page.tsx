"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Loader2, Phone } from "lucide-react";

/**
 * Beta waitlist landing — shown when a creator (or customer) hits
 * `sms_send_failed` from /api/v1/auth/request-otp because A2P 10DLC
 * registration is still pending. We never expose that detail to them;
 * to the user this is just "you're on the beta list."
 *
 * For creators specifically, the handle they typed on the landing page
 * (stored in sessionStorage as `kder_onboarding_handle`) is already in
 * hand — we don't ask them again. On mount we POST to
 * /api/v1/beta/waitlist with phone + handle, which writes a row into
 * the `waitlist_signups` table. That table is consulted by the
 * existing /api/v1/handles/check endpoint, so the handle is locked to
 * this phone — no real signup can grab it before the operator manually
 * activates this user.
 *
 * Customers don't have handles in KDER's model, so the auto-reserve
 * step is skipped for them — they just see the confirmation copy.
 */

type ReserveState =
  | { kind: "idle" }
  | { kind: "reserving" }
  | { kind: "reserved"; handle: string }
  | { kind: "no-handle" }
  | { kind: "error"; message: string };

function WaitlistInner() {
  const [phone, setPhone] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [reserve, setReserve] = useState<ReserveState>({ kind: "idle" });
  // Guard against StrictMode double-fire in dev.
  const reservedOnceRef = useRef(false);

  useEffect(() => {
    // Defer setState via setTimeout(0) to satisfy React 19's
    // react-hooks/set-state-in-effect rule (the reservation kicks off
    // a state machine that cascades into more setStates).
    const id = setTimeout(() => {
      const storedPhone = sessionStorage.getItem("kder_signup_phone");
      const storedMode = sessionStorage.getItem("kder_signup_mode");
      const storedHandle = sessionStorage.getItem("kder_onboarding_handle");
      setPhone(storedPhone);
      setMode(storedMode);

      // Only creators reserve handles. Customer-mode signups skip
      // straight to the confirmation copy.
      const isCreator = storedMode !== "customer";
      if (!isCreator) return;
      if (!storedPhone) {
        setReserve({ kind: "no-handle" });
        return;
      }
      if (!storedHandle) {
        // Creator who somehow reached /signup without going through
        // the landing-page handle picker. Rare but possible (deep link).
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
        // Handle taken / reserved by someone else — surface a useful
        // message so the user knows to pick a different handle next.
        const message =
          json.code === "handle_taken" || json.code === "handle_reserved"
            ? "That handle was just taken. Pop back to the home page and pick another."
            : json.error ||
              "We couldn't lock in that handle just now. Try again in a moment.";
        setReserve({ kind: "error", message });
        return;
      }
      const reservedHandle = json.data?.handle ?? rawHandle.toLowerCase();
      setReserve({ kind: "reserved", handle: reservedHandle });
    } catch {
      setReserve({
        kind: "error",
        message:
          "Couldn't reach the server. Your number is saved — we'll text you soon.",
      });
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
          You&apos;re on the list
        </h2>

        <p className="text-base text-white/70">
          KDER is in private beta right now. We&apos;ve saved your number and
          will text you the moment access opens up — usually within a few
          days.
        </p>

        {tail && (
          <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm text-white/80">
            <Phone size={14} className="text-white/50" />
            We&apos;ll text {display || `…${tail}`}
          </div>
        )}

        {/* Creator-only: handle reservation status. We auto-reserve on
            mount using the handle they typed on the landing page; this
            block surfaces the lifecycle of that POST. */}
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
        {isCreator && reserve.kind === "error" && (
          <p className="text-xs text-orange-300/90">{reserve.message}</p>
        )}

        <p className="text-xs text-white/40">
          Beta tester already? Reach out and we&apos;ll get your number
          activated right away.
        </p>
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
