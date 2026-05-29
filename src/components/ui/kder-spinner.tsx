import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand-aware loading indicator: the KDER mark rotating slowly
 * with a green outer glow. Replaces lucide's generic Loader2 +
 * the `border-2 border-green-400 border-t-transparent` ring on
 * page-level loading states across the app.
 *
 * Why slow rotation: the K-mark is asymmetric, so the default
 * 1s `animate-spin` reads as a stuttering twist. The custom
 * 2.4s `animate-kder-spin` (defined in globals.css) reads as a
 * deliberate rotation. Auto-falls-back to a fade-pulse for
 * users with prefers-reduced-motion.
 *
 * Usage:
 *   <KderSpinner size={64} />                     // default
 *   <KderSpinner size={32} label="Loading…" />    // with caption
 *
 * For tiny in-button spinners (16-20px), keep using lucide's
 * Loader2 — this component is for page-level / panel-level
 * indicators where the brand recognition is worth the visual
 * weight.
 */
interface Props {
  /** Pixel size of the logo. Default 64. Picks naturally between
   *  48 (compact panels) → 64 (page loading) → 96 (full-screen
   *  veils like the auth redirect). */
  size?: number;
  /** Optional caption shown below the mark. Use sparingly —
   *  the spinning logo alone communicates "loading." */
  label?: string;
  className?: string;
}

export function KderSpinner({ size = 64, label, className }: Props) {
  return (
    <div
      role="status"
      aria-label={label ?? "Loading"}
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Image
        src="/icons/kder-logo.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        // Drop-shadow gives the rotation a sense of mass + brand
        // glow. Prefers-reduced-motion swaps animate-kder-spin
        // for a fade-pulse via globals.css.
        className="animate-kder-spin"
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 ${Math.round(size / 4)}px rgba(46,125,50,0.55))`,
        }}
        priority
      />
      {label && (
        <p className="text-xs font-medium text-white/55">{label}</p>
      )}
    </div>
  );
}
