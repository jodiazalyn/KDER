import { Wifi } from "lucide-react";

/**
 * CSS-rendered KDER metal-debit card mockup. Same approach as the
 * phone screens — no PNG asset, pixel-perfect at any size, always
 * matches the brand. Used inside `<CreatorCards />` as the visual
 * anchor for the card-product pitch.
 *
 * Standard credit-card aspect ratio (1.586:1, derived from the ISO
 * 7810 ID-1 spec — 85.6mm × 53.98mm). Layered gradient + a soft
 * inner highlight band approximate the look of a brushed-metal
 * card without going overboard.
 *
 * Cardholder name and number are intentionally fictional. If we ever
 * surface a real signed-off creator for marketing, swap in their
 * name + last-four.
 */

interface CreatorCardMockupProps {
  className?: string;
}

export function CreatorCardMockup({ className = "" }: CreatorCardMockupProps) {
  return (
    <div
      className={[
        "relative w-full max-w-[420px]",
        "aspect-[1.586/1] rounded-[20px]",
        // Brushed-metal feel: stacked dark-green gradients + a faint
        // diagonal highlight band layered via radial-gradient.
        "bg-gradient-to-br from-[#0F3D14] via-[#1B5E20] to-[#0A2A0E]",
        "shadow-[0_30px_60px_-15px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      ].join(" ")}
      role="img"
      aria-label="KDER metal debit card mockup"
    >
      {/* Subtle highlight band — fakes a brushed-metal sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[20px]"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.10) 0%, transparent 55%)",
        }}
      />

      {/* Top row — KDER wordmark + contactless icon */}
      <div className="absolute inset-x-6 top-6 flex items-start justify-between text-white">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.32em] text-white/60">
            KDER
          </span>
          <span className="mt-0.5 block text-[10px] font-medium text-white/45">
            Founder Card
          </span>
        </div>
        <Wifi
          size={18}
          strokeWidth={2.5}
          className="rotate-90 text-white/70"
        />
      </div>

      {/* Chip — small gold/bronze rectangle, the card's tactile
          centerpiece. CSS-only, no SVG. */}
      <div
        aria-hidden="true"
        className="absolute left-6 top-[44%] -translate-y-1/2"
      >
        <div className="relative h-8 w-11 overflow-hidden rounded-[4px] bg-gradient-to-br from-[#F2D588] via-[#C9A04C] to-[#8C6A28]">
          {/* Chip contact lines */}
          <div className="absolute inset-1 flex flex-col justify-between">
            <span className="block h-px bg-black/30" />
            <span className="block h-px bg-black/30" />
            <span className="block h-px bg-black/30" />
          </div>
          <div className="absolute inset-y-1 left-1/2 w-px bg-black/30" />
        </div>
      </div>

      {/* Card number — mostly dots so we don't fake real digits */}
      <div className="absolute inset-x-6 top-[60%] -translate-y-1/2 font-mono text-base font-semibold tracking-[0.2em] text-white/90 sm:text-lg">
        •••• •••• •••• 4218
      </div>

      {/* Bottom row — cardholder name + network mark */}
      <div className="absolute inset-x-6 bottom-5 flex items-end justify-between">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Cardholder
          </p>
          <p className="mt-0.5 text-sm font-bold uppercase tracking-wider text-white">
            Marisol R
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Network
          </p>
          <p className="mt-0.5 font-extrabold italic tracking-tight text-white">
            VISA
          </p>
        </div>
      </div>
    </div>
  );
}
