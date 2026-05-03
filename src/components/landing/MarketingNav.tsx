import Image from "next/image";
import Link from "next/link";

/**
 * Sticky top nav for the marketing landing. Light-theme rewrite of the
 * original dark nav.
 *
 * Sticky (not fixed) so it gets pushed off as the user scrolls past
 * the hero — keeps the view uncluttered for the long-form content
 * sections below. Fixed nav looked over-anchored on a marketing page.
 *
 * Both `Log in` and `Get early access` route to `/signup` (the OTP
 * flow itself decides whether the visitor is a new applicant or a
 * returning member). Identical behavior to the previous landing.
 */

export function MarketingNav() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-kder-line bg-kder-cream/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link
          href="/"
          aria-label="KDER home"
          className="flex items-center gap-2"
        >
          <Image
            src="/icons/kder-logo.png"
            alt=""
            width={28}
            height={28}
            priority
          />
          <span className="text-sm font-extrabold tracking-[0.2em] text-kder-ink">
            KDER
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-full px-4 text-xs font-semibold text-kder-ink-muted transition-colors hover:text-kder-ink"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-full bg-kder-green px-4 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-[#207024]"
          >
            Get early access
          </Link>
        </div>
      </div>
    </header>
  );
}
