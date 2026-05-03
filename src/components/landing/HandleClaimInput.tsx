"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, X } from "lucide-react";

/**
 * Self-contained handle-claim input — the most-loved interaction on
 * the current landing page, extracted from `src/app/page.tsx` so the
 * marketing page composition can drop it into any section without
 * prop-drilling state.
 *
 * Behavior preserved 1:1 from the original:
 * - Live availability check via `/api/v1/handles/check` (debounced
 *   400ms after typing stops).
 * - Sanitizes input to the canonical handle character set (lowercase
 *   alphanumerics + underscore, 3-30 chars).
 * - On successful claim, stores the handle under sessionStorage key
 *   `kder_onboarding_handle` so the /signup flow can pre-fill it.
 * - Navigates to `/signup` (default) or `/signup/waitlist` (waitlist
 *   variant) after claim.
 *
 * Theme variants:
 *   - `light` (default): cream/paper marketing surfaces — used in Hero.
 *   - `on-green`: white-on-KDER-green — kept available for any future
 *     section that wants to overlay this input on the brand-green block.
 */

const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;
const HANDLE_DEBOUNCE_MS = 400;

type HandleStatus = "idle" | "checking" | "available" | "taken";

interface HandleClaimInputProps {
  /** "light" sits on cream surfaces; "on-green" sits on the green CTA block. */
  theme?: "light" | "on-green";
  /** "/signup" (default) or "/signup/waitlist". */
  destination?: "/signup" | "/signup/waitlist";
  /** Optional className passthrough for spacing tweaks per section. */
  className?: string;
}

export function HandleClaimInput({
  theme = "light",
  destination = "/signup",
  className = "",
}: HandleClaimInputProps) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<HandleStatus>("idle");
  const [claiming, setClaiming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const checkAvailability = useCallback(async (value: string) => {
    if (!HANDLE_REGEX.test(value)) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    try {
      const res = await fetch(
        `/api/v1/handles/check?handle=${encodeURIComponent(value)}`
      );
      const json = await res.json();
      setStatus(json.data?.available ? "available" : "taken");
    } catch {
      setStatus("idle");
    }
  }, []);

  const onChange = (raw: string) => {
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    setHandle(sanitized);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!sanitized || sanitized.length < 3) {
      setStatus("idle");
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

  const canClaim = status === "available" && !claiming;

  const onClaim = () => {
    if (!canClaim) return;
    setClaiming(true);
    try {
      sessionStorage.setItem("kder_onboarding_handle", handle);
    } catch {
      // sessionStorage blocked (private mode, etc.) — proceed anyway.
    }
    router.push(destination);
  };

  // Tailwind class shapes per theme. Centralized here so both the
  // input row and the status/help line stay visually coherent.
  const isOnGreen = theme === "on-green";
  const wrapperBase =
    "flex w-full flex-col items-stretch gap-2 rounded-[28px] border p-1.5 transition-colors sm:flex-row sm:items-center sm:rounded-full";
  const wrapperTheme = isOnGreen
    ? "border-white/30 bg-white/10 backdrop-blur-md focus-within:border-white/60"
    : "border-kder-line bg-kder-paper focus-within:border-kder-ink/30";
  const wrapperStatus =
    status === "available"
      ? isOnGreen
        ? "border-white/70 shadow-[0_0_24px_rgba(255,255,255,0.2)]"
        : "border-kder-green shadow-[0_0_0_4px_rgba(27,94,32,0.10)]"
      : status === "taken"
        ? "border-red-400/60"
        : "";

  const prefixColor = isOnGreen ? "text-white/60" : "text-kder-ink-muted";
  const inputColor = isOnGreen
    ? "text-white placeholder:text-white/40"
    : "text-kder-ink placeholder:text-kder-ink-muted/50";
  const buttonTheme = isOnGreen
    ? "bg-white text-kder-green hover:bg-white/95"
    : "bg-kder-green text-white hover:bg-[#207024]";

  const statusLineColor = isOnGreen ? "text-white/85" : "text-kder-ink-muted";
  const statusOkColor = isOnGreen ? "text-white" : "text-kder-green";
  const statusErrColor = isOnGreen ? "text-red-200" : "text-red-600";

  return (
    <div className={className}>
      <label htmlFor="hero-handle" className="sr-only">
        Your KDER handle
      </label>
      <div
        className={`${wrapperBase} ${wrapperTheme} ${wrapperStatus}`.trim()}
      >
        <div className="flex flex-1 items-center gap-1 px-4 py-2 sm:py-0">
          <span
            className={`select-none whitespace-nowrap text-sm font-medium ${prefixColor}`}
          >
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
            // text-base on mobile prevents iOS Safari auto-zoom on focus.
            className={`h-12 flex-1 bg-transparent text-base font-medium focus:outline-none sm:h-10 ${inputColor}`}
          />
        </div>

        <button
          type="button"
          onClick={onClaim}
          disabled={!canClaim}
          aria-label={
            handle ? `Claim handle ${handle}` : "Enter a handle to claim"
          }
          className={`group inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-sm font-bold transition-all enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-kder-line disabled:text-kder-ink-muted/60 sm:h-10 sm:min-w-[120px] ${buttonTheme}`}
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

      {/* Availability status line — fixed height so the layout
          doesn't jump as the line content changes. */}
      <div
        id="handle-status"
        className={`mt-3 h-5 text-xs ${statusLineColor}`}
        role="status"
        aria-live="polite"
      >
        {status === "idle" && handle.length > 0 && handle.length < 3 && (
          <span>3–30 characters · letters, numbers, underscores</span>
        )}
        {status === "checking" && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Checking availability…
          </span>
        )}
        {status === "available" && (
          <span
            className={`inline-flex items-center gap-1.5 ${statusOkColor}`}
          >
            <Check size={12} />
            <strong className="font-semibold">@{handle}</strong> is yours.
            Click claim to continue.
          </span>
        )}
        {status === "taken" && (
          <span
            className={`inline-flex items-center gap-1.5 ${statusErrColor}`}
          >
            <X size={12} />
            <strong className="font-semibold">@{handle}</strong> is already
            taken. Try another.
          </span>
        )}
      </div>
    </div>
  );
}
