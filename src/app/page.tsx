"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setTimeout(() => {
          router.replace(session ? "/dashboard" : "/signup");
        }, 1800);
      } catch {
        // If Supabase isn't configured (demo mode), go to signup
        setTimeout(() => {
          router.replace("/signup");
        }, 1800);
      }
    };

    checkSession();
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0A0A0A]">
      {/* Green radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(46,125,50,0.25) 0%, transparent 65%)",
        }}
      />

      {/* KDER Logo */}
      <div
        className="relative mb-6"
        style={{
          filter: "drop-shadow(0 0 40px rgba(46,125,50,0.6))",
        }}
      >
        <Image
          src="/icons/kder-logo.png"
          alt="KDER — Hospitality Sovereignty Platform"
          width={180}
          height={180}
          priority
        />
      </div>

      {/* KDER Wordmark */}
      <h1
        className="text-6xl font-black tracking-widest text-white"
        style={{
          filter: "drop-shadow(0 0 40px rgba(46,125,50,0.6))",
        }}
      >
        KDER
      </h1>

      {/* Tagline */}
      <p className="mt-4 text-lg italic text-green-300">
        Sovereign Hospitality
      </p>
    </main>
  );
}
