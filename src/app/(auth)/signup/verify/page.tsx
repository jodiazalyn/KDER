"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { OtpInput } from "@/components/auth/OtpInput";
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

        // Clear stored phone
        sessionStorage.removeItem("kder_signup_phone");

        // Branch on signup mode set on /signup?mode=customer
        const mode = sessionStorage.getItem("kder_signup_mode");
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
    <main className="relative flex min-h-screen flex-col items-center px-6 py-12 bg-[#0A0A0A]">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
        aria-label="Go back"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-green-400" />
          <p className="mt-4 text-lg text-white/80">Verifying...</p>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-black text-white">Enter your code</h1>
          <p className="text-sm text-white/60">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-white/80">{displayPhone}</span>
          </p>
        </div>

        <OtpInput
          onComplete={handleComplete}
          error={error}
          errorKey={errorKey}
          disabled={loading}
        />

        {error && (
          <p className="text-sm text-red-400" role="alert">
            Incorrect code. Try again.
          </p>
        )}

        <div className="flex flex-col items-center gap-1">
          {locked ? (
            <p className="text-sm text-red-400">
              Too many attempts. Wait 1 hour.
            </p>
          ) : countdown > 0 ? (
            <p className="text-sm text-white/40">
              Resend code in 0:{countdown.toString().padStart(2, "0")}
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-sm font-medium text-green-400 hover:text-green-300 active:scale-95"
            >
              Resend code
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
