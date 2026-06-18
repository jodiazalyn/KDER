"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { OtpInput } from "@/components/auth/OtpInput";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";
import { toast } from "sonner";

const RESEND_COOLDOWN = 45;
const MAX_RESENDS = 3;

export default function VerifyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorKey, setErrorKey] = useState(0);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendCount, setResendCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const otpCoachRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("kder_signup_phone");
    if (!storedPhone) {
      router.replace("/signup");
      return;
    }
    setPhone(storedPhone);
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0 || locked || loading) return;

    if (resendCount >= MAX_RESENDS) {
      setLocked(true);
      toast.error(
        "Too many attempts. Please wait 1 hour before trying again."
      );
      return;
    }

    try {
      await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setResendCount((c) => c + 1);
      setCountdown(RESEND_COOLDOWN);
      toast.success("New code sent!");
    } catch {
      toast.error("Failed to resend code. Try again.");
    }
  };

  const handleComplete = useCallback(
    async (code: string) => {
      if (loading) return;
      setLoading(true);
      setError(false);

      try {
        const res = await fetch("/api/v1/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code }),
        });

        const json = await res.json();

        if (!res.ok) {
          setError(true);
          setErrorKey((k) => k + 1);
          // Surface the Supabase verify error code when present (e.g.
          // otp_expired, invalid_otp) so creators can share a specific
          // identifier with support if they need help.
          const code = typeof json.code === "string" ? ` [${json.code}]` : "";
          toast.error(
            `${json.error || "Incorrect code. Try again."}${code}`
          );
          return;
        }

        // Read all routing-relevant sessionStorage values BEFORE the
        // cleanup below — removing items first would null these out.
        const mode = sessionStorage.getItem("kder_signup_mode");
        const next = sessionStorage.getItem("kder_signup_next");

        // Auth-flow keys we own end-to-end and are safe to clear here.
        // Note: kder_signup_next and kder_signup_action are
        // intentionally NOT cleared — the destination page (storefront
        // / customer onboarding) consumes them to resume the
        // customer's flow (auto-open checkout sheet, etc.). See
        // src/app/onboarding/customer/page.tsx:43-44 for the
        // matching convention.
        sessionStorage.removeItem("kder_signup_phone");
        sessionStorage.removeItem("kder_signup_mode");
        sessionStorage.removeItem("kder_onboarding_handle");

        // Returning user → they already have a public.members row.
        // Split by role so customers always land on the storefront
        // they came from (per product requirement: customers don't
        // have a personal home, only the creator's storefront link),
        // and creators land on their dashboard.
        // Strict === false / === true checks: any unexpected shape
        // (missing field, parse hiccup) falls through to the existing
        // new-user flow, and within the returning branch defaults to
        // the customer path — safer than dropping a non-creator onto
        // /dashboard.
        if (json?.data?.isNewUser === false) {
          if (json?.data?.isCreator === true) {
            router.replace("/dashboard");
          } else {
            // Customer → back to the storefront link they clicked
            // from the creator. In normal flow `next` is always set
            // (see src/app/(auth)/signup/page.tsx:30 — `?next=` is
            // stamped into sessionStorage on every customer entry).
            // The `|| "/"` fallback is purely defensive.
            router.replace(next || "/");
          }
          return;
        }

        // New user — first time finishing OTP. Route into onboarding
        // based on the mode they picked on the landing page.
        if (mode === "customer") {
          router.push("/onboarding/customer");
        } else {
          router.push("/onboarding/profile");
        }
      } catch {
        setError(true);
        setErrorKey((k) => k + 1);
        toast.error(
          "Verification failed. Check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    },
    [phone, loading, router]
  );

  // Format phone for display
  const displayPhone = phone
    ? phone.replace(
        /^\+1(\d{3})(\d{3})(\d{4})$/,
        "($1) $2-$3"
      )
    : "";

  return (
    <main className="relative flex min-h-screen flex-col items-center px-6 py-12 bg-background">
      {/* Back button — glass-btn-pill at Apple HIG 44px tap target */}
      <button
        onClick={() => router.back()}
        className="glass-btn-pill absolute left-4 top-4 flex h-12 w-12 items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
        aria-label="Go back"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Loading overlay — translucent glass scrim */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[24px] backdrop-saturate-[180%]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Verifying...</p>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-black text-foreground">Enter your code</h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{displayPhone}</span>
          </p>
        </div>

        <div ref={otpCoachRef} className="w-full flex justify-center">
          <OtpInput
            onComplete={handleComplete}
            error={error}
            errorKey={errorKey}
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            Incorrect code. Try again.
          </p>
        )}

        <div className="flex flex-col items-center gap-1">
          {locked ? (
            <p className="text-sm text-destructive">
              Too many attempts. Wait 1 hour.
            </p>
          ) : countdown > 0 ? (
            <p className="text-sm text-muted-foreground">
              Resend code in 0:{countdown.toString().padStart(2, "0")}
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-sm font-medium text-primary hover:text-primary/80 active:scale-95"
            >
              Resend code
            </button>
          )}
        </div>

        {/* Beta-window escape hatch — KDER is invite-only while we're
            approving members by hand. Users who don't have a code
            (because we haven't onboarded them yet) self-select into
            the waitlist here. Once an admin adds their phone to the
            Supabase test phone list and DMs them their code, they
            come back to this same screen and enter it. */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="h-px w-12 bg-border" aria-hidden />
          <p className="text-xs text-muted-foreground">Don&apos;t have a code yet?</p>
          <Link
            href="/signup/waitlist"
            className="text-sm font-semibold text-foreground underline-offset-4 hover:underline active:scale-95"
          >
            Apply for access →
          </Link>
        </div>
      </div>

      {/* First-visit tip explaining the OTP code mechanics. Fires once
          per device. */}
      <Coachmark
        id="creator-signup-otp"
        copy={COACHMARK_COPY["creator-signup-otp"]}
        targetRef={otpCoachRef}
        showDelayMs={400}
      />
    </main>
  );
}
