import Image from "next/image";

/**
 * Lightweight iPhone-shaped frame for the landing page's hero
 * mockups. Dark device chrome on cream surfaces is the page's main
 * visual contrast — exactly Stooty's pattern. Implemented with CSS +
 * a single inline SVG notch so we don't pay for a 3D mockup library.
 *
 * Pass a `src` pointing to a 390×844-equivalent screenshot (we
 * recommend 780×1688 @2x to look crisp on Retina). The image is
 * `object-cover`'d into the frame so any reasonable aspect ratio
 * still looks intentional.
 *
 * NOTE: phone screenshot assets live under
 * `/public/images/landing/storefront-phone.png` and
 * `/public/images/landing/order-phone.png`. They must be added
 * before merge — see the regen note in `Hero.tsx`.
 */

interface PhoneFrameProps {
  src: string;
  alt: string;
  /** "primary" stacks slightly forward; "secondary" sits behind. */
  variant?: "primary" | "secondary";
  className?: string;
}

export function PhoneFrame({
  src,
  alt,
  variant = "primary",
  className = "",
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
      {/* Inner screen surface */}
      <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-black">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 60vw, 280px"
          className="object-cover"
          priority={variant === "primary"}
        />
        {/* Notch: a black pill centered at the top of the screen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-2 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-black"
        />
      </div>
    </div>
  );
}
