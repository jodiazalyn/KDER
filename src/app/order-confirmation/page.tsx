"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-6">
      <Image
        src="/icons/kder-logo.png"
        alt="KDER"
        width={80}
        height={80}
        className="mb-6"
      />

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-900/40 mb-4">
        <CheckCircle2 size={40} className="text-green-400" />
      </div>

      <h1 className="text-2xl font-black text-white">Payment Successful!</h1>

      <p className="mt-3 max-w-sm text-center text-sm text-white/50 leading-relaxed">
        Your order has been placed and the creator has been notified.
        They&apos;ll confirm your order shortly.
      </p>

      {sessionId && (
        <p className="mt-4 text-xs text-white/20">
          Confirmation: {sessionId.slice(-8)}
        </p>
      )}

      <Link
        href="/"
        className="mt-8 flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-white/25 text-sm font-bold text-white hover:bg-white/[0.06] active:scale-95 transition-all"
      >
        Back to KDER
      </Link>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
          <p className="text-white/50">Loading...</p>
        </main>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
