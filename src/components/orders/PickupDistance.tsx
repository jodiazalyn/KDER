"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Navigation } from "lucide-react";
import {
  estimateDriveMinutes,
  formatDistanceMiles,
  formatEta,
  geocodeAddress,
  getCurrentPosition,
  haversineMiles,
  mapsDirectionsUrl,
} from "@/lib/geo/distance";

type Phase = "idle" | "loading" | "done" | "error";

/**
 * Customer-facing "how far am I from pickup" indicator. Shown on the order
 * confirmation page once a pickup order is ready and the address is
 * revealed. Tap-to-check (rather than auto-prompting for location) so we
 * never surprise the customer with a permission dialog they didn't ask for.
 *
 * Renders on a dark surface (order-confirmation page), hence the white/…
 * token palette to match the surrounding fulfillment block.
 */
export function PickupDistance({ address }: { address: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [miles, setMiles] = useState<number | null>(null);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const check = async () => {
    setPhase("loading");
    setError("");
    const [here, there] = await Promise.all([
      getCurrentPosition(),
      geocodeAddress(address),
    ]);
    if (!mountedRef.current) return;
    if (!here) {
      setPhase("error");
      setError("Couldn't get your location. Check location access and retry.");
      return;
    }
    if (!there) {
      setPhase("error");
      setError("Couldn't locate the pickup address.");
      return;
    }
    setMiles(haversineMiles(here, there));
    setPhase("done");
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {phase === "done" && miles !== null ? (
          <span className="inline-flex items-center gap-1.5 text-white/80">
            <Navigation size={13} className="text-green-300" />
            <span>
              About{" "}
              <span className="font-semibold text-white">
                {formatDistanceMiles(miles)}
              </span>
              {formatEta(estimateDriveMinutes(miles)) && (
                <>
                  {" · "}
                  <span className="font-semibold text-white">
                    {formatEta(estimateDriveMinutes(miles))}
                  </span>{" "}
                  by car
                </>
              )}
            </span>
            <button
              type="button"
              onClick={check}
              className="text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
            >
              recheck
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={check}
            disabled={phase === "loading"}
            className="inline-flex items-center gap-1.5 text-green-300 underline-offset-2 hover:text-green-200 hover:underline disabled:opacity-60"
          >
            {phase === "loading" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Navigation size={13} />
            )}
            {phase === "loading" ? "Locating…" : "How far am I?"}
          </button>
        )}

        <a
          href={mapsDirectionsUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 underline-offset-2 hover:text-white/90 hover:underline"
        >
          Directions
        </a>
      </div>

      {phase === "error" && (
        <p className="mt-1 text-[11px] text-red-300/80">{error}</p>
      )}
    </div>
  );
}
