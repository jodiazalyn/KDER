"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAME_MAX = 40;

/**
 * Minimal customer onboarding — one screen, just display name.
 * Redirects back to the `kder_signup_next` URL after save so the
 * customer returns to the storefront they started from.
 */
export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = displayName.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      const res = await fetch("/api/v1/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Couldn't save your name. Try again.");
        return;
      }

      const next = sessionStorage.getItem("kder_signup_next");
      sessionStorage.removeItem("kder_signup_mode");
      sessionStorage.removeItem("kder_signup_next");
      // kder_signup_action stays so the storefront can read it and auto-open
      // the message/checkout sheet after redirect.

      router.replace(next || "/");
    } catch {
      toast.error("Couldn't save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between px-6 py-12 bg-[#0A0A0A]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(46,125,50,0.12) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center pt-12">
        <Image
          src="/icons/kder-logo.png"
          alt="KDER"
          width={72}
          height={72}
          priority
        />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <h1 className="text-2xl font-black text-white text-center">
          What should we call you?
        </h1>
        <p className="text-sm text-white/60 text-center">
          Creators will see this name when you message or order.
        </p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, NAME_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="Your name"
          autoFocus
          className="h-14 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/35 focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
        />
        <p className="self-end text-xs text-white/30">
          {displayName.length}/{NAME_MAX}
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm pb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-white transition-all active:scale-95",
            canSubmit
              ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              : "bg-white/10 cursor-not-allowed opacity-50"
          )}
        >
          {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : "Continue"}
        </button>
      </div>
    </main>
  );
}
