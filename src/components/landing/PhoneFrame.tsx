import Image from "next/image";

/**
 * Lightweight iPhone-shaped frame for the landing page's mockups.
 * Dark device chrome on cream surfaces is the page's main visual
 * contrast — exactly Stooty's pattern. Implemented with CSS + a
 * single inline SVG notch so we don't pay for a 3D mockup library.
 *
 * Two render modes:
 *
 *   1. Pass `children` (preferred) — render a JSX phone-screen
 *      component (e.g. `<StorefrontPhoneScreen />`). Pixel-perfect,
 *      no PNG assets to manage, never goes blurry, never has a
 *      missing-asset state. This is what the marketing landing
 *      uses today — Stooty's mockups are designed UI, not raw
 *      screenshots, for the same reasons.
 *
 *   2. Pass `src` (fallback) — point at a 390×844-equivalent PNG
 *      (we recommend 780×1688 @2x for Retina). Useful if/when we
 *      want to drop in real captures of the live product.
 */

interface PhoneFrameProps {
  /** "primary" stacks slightly forward; "secondary" sits behind. */
  variant?: "primary" | "secondary";
  className?: string;
  /** Render-mode 1: JSX content sized to the phone screen. */
  children?: React.ReactNode;
  /** Render-mode 2: PNG src. Required if `children` is not provided. */
  src?: string;
  /** Required when using `src` — alt text for the screenshot. */
  alt?: string;
}

export function PhoneFrame({
  variant = "primary",
  className = "",
  children,
  src,
  alt,
}: PhoneFrameProps) {
  return (
    <div
      className={[
        "relative aspect-[9/19] w-full max-w-[280px]",
        // The drop-shadow gives the dark device chrome lift off the
        // cream — our main "this is real" visual cue.
        "rounded-[44px] bg-[#0A0A0A] p-[10px]",
        variant === "primary"
          ? "shadow-[0_30px_60px_-15px_rgba(15,15,15,0.35)]"
          : "shadow-[0_20px_40px_-15px_rgba(15,15,15,0.22)]",
        className,
      ].join(" ")}
    >
      {/* Inner screen surface — black baseline so any unfilled gaps
          read as device chrome rather than transparent paper. */}
      <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#0A0A0A]">
        {children ? (
          <div className="absolute inset-0 overflow-hidden text-white">
            {children}
          </div>
        ) : src ? (
          <Image
            src={src}
            alt={alt ?? ""}
            fill
            sizes="(max-width: 1024px) 60vw, 280px"
            className="object-cover"
            priority={variant === "primary"}
          />
        ) : null}

        {/* Notch: a black pill centered at the top of the screen.
            Layered above content so it's visible regardless of the
            screen's own top-row treatment. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-2 z-20 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-black"
        />
      </div>
    </div>
  );
}
