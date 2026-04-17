"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { cn } from "@/lib/utils";

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const DEBOUNCE_MS = 400;

type AvailabilityState = "idle" | "checking" | "available" | "taken";

export default function HandlePage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<AvailabilityState>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isValidFormat = HANDLE_REGEX.test(handle);
  const canContinue = isValidFormat && status === "available";

  const checkAvailability = useCallback(async (value: string) => {
    if (!HANDLE_REGEX.test(value)) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }

    setStatus("checking");

    try {
      const res = await fetch(
        `/api/v1/handles/check?handle=${encodeURIComponent(value)}`
      );
      const json = await res.json();

      if (json.data?.available) {
        setStatus("available");
        setSuggestions([]);
      } else {
        setStatus("taken");
        setSuggestions(json.data?.suggestions || []);
      }
    } catch {
      setStatus("idle");
    }
  }, []);

  const handleInputChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    setHandle(sanitized);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!sanitized || sanitized.length < 3) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      checkAvailability(sanitized);
    }, DEBOUNCE_MS);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Restore handle from sessionStorage if the user entered one on the landing page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("kder_onboarding_handle");
      if (saved && HANDLE_REGEX.test(saved)) {
        setHandle(saved);
        checkAvailability(saved);
      }
    } catch {
      // sessionStorage blocked — no-op
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    if (!canContinue || loading) return;
    setLoading(true);

    sessionStorage.setItem("kder_onboarding_handle", handle.toLowerCase());
    router.push("/onboarding/terms");
  };

  const selectSuggestion = (suggestion: string) => {
    setHandle(suggestion);
  };

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-12 bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <ProgressDots current={2} total={3} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-black text-white">
            Choose your KDER link
          </h1>
          <p className="text-sm text-white/50">
            This is how people find your storefront
          </p>
        </div>

        {/* Handle input with preview */}
        <div className="w-full">
          <div className="flex items-center rounded-2xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] transition-colors focus-within:border-green-400/60 focus-within:bg-white/[0.12]">
            <span className="pl-4 text-base text-white/40 select-none">
              kder.club/@
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="yourname"
              autoFocus
              className="h-12 flex-1 bg-transparent pr-12 text-base text-white placeholder:text-white/35 focus:outline-none"
              aria-label="Profile handle"
            />

            {/* Status indicator */}
            <div className="absolute right-10 flex items-center pr-4">
              {status === "checking" && (
                <Loader2 className="h-5 w-5 animate-spin text-white/40" />
              )}
              {status === "available" && (
                <Check className="h-5 w-5 text-green-400" />
              )}
              {status === "taken" && (
                <X className="h-5 w-5 text-red-400" />
              )}
            </div>
          </div>

          {/* Availability feedback */}
          <div className="mt-2 min-h-[24px]">
            {status === "available" && (
              <p className="text-sm font-medium text-green-400">
                Available!
              </p>
            )}
            {status === "taken" && (
              <p className="text-sm font-medium text-red-400">
                That handle is taken. Try one of these:
              </p>
            )}
            {handle.length > 0 && handle.length < 3 && (
              <p className="text-sm text-white/40">
                At least 3 characters
              </p>
            )}
            {handle.length === 0 && (
              <p className="text-sm text-white/30">
                Letters, numbers, underscores only. 3–30 characters.
              </p>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => selectSuggestion(s)}
                  className="rounded-full border border-white/[0.15] bg-white/[0.06] px-4 py-2 text-sm text-white/80 backdrop-blur-[8px] hover:border-green-400/40 hover:bg-white/[0.1] active:scale-95 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="w-full max-w-sm mx-auto pt-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue || loading}
          className={cn(
            "flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-white transition-all duration-200",
            "active:scale-95",
            canContinue && !loading
              ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              : "bg-white/10 cursor-not-allowed opacity-50"
          )}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </main>
  );
}
