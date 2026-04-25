"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = phone.length === 10;

  // Stash mode/next/action query params for the verify + onboarding pages.
  // Customers land here from storefront message/checkout flows with
  // ?mode=customer&next=/@handle&action=message|checkout
  useEffect(() => {
    const mode = searchParams.get("mode");
    const next = searchParams.get("next");
    const action = searchParams.get("action");

    if (mode) sessionStorage.setItem("kder_signup_mode", mode);
    else sessionStorage.removeItem("kder_signup_mode");

    if (next) sessionStorage.setItem("kder_signup_next", next);
    else sessionStorage.removeItem("kder_signup_next");

    if (action) sessionStorage.setItem("kder_signup_action", action);
    else sessionStorage.removeItem("kder_signup_action");
  }, [searchParams]);

  const handleSendCode = async () => {
    if (!isValid || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+1${phone}` }),
      });

      const json = await res.json();

      if (!res.ok) {
        // Surface the Supabase error code (when present) so users can
        // share a specific identifier rather than a generic toast.
        const code = typeof json.code === "string" ? ` [${json.code}]` : "";
        toast.error(
          `${json.error || "Failed to send code. Try again."}${code}`
        );
        return;
      }

      // Store phone in sessionStorage for the verify screen
      sessionStorage.setItem("kder_signup_phone", `+1${phone}`);
      router.push("/signup/verify");
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between px-6 py-12 bg-[#0A0A0A]">
      {/* Green radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(46,125,50,0.12) 0%, transparent 65%)",
        }}
      />

      {/* Top section — Logo */}
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

      {/* Center section — Phone input */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <h2 className="text-xl font-bold text-white">
          Enter your phone number
        </h2>
        <PhoneInput
          value={phone}
          onChange={setPhone}
          disabled={loading}
        />
      </div>

      {/* Bottom section — CTA + legal */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 pb-4">
        <button
          onClick={handleSendCode}
          disabled={!isValid || loading}
          className={cn(
            "flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-white transition-all duration-200",
            "active:scale-95",
            isValid && !loading
              ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              : "bg-white/10 cursor-not-allowed opacity-50"
          )}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            "Send Code"
          )}
        </button>

        <p className="text-center text-xs text-white/40">
          By continuing you agree to our{" "}
          <button
            type="button"
            className="underline text-white/60 hover:text-white/80"
            onClick={() => toast.info("Terms of Service — coming soon")}
          >
            Terms of Service
          </button>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}
