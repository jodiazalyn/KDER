import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Light-theme rewrite of the previous dark footer. Same routes,
 * same brand mark, same photo attribution — restyled for
 * cream surfaces and ink-muted text.
 *
 * The image attribution line is surfaced visibly here (in addition
 * to the `metadata.other` entry in `layout.tsx`) per the original
 * landing page's credit promise.
 */

const FOR_CREATORS = [
  { label: "Start selling", href: "/signup" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing — always free", href: null },
];

const FOR_FOODIES = [
  { label: "Discover creators — soon", href: null },
  { label: "Safe payments", href: null },
  { label: "Ratings & reviews", href: null },
];

/** Brand glyphs (filled, 24×24) so all five read as one consistent set. */
type IconProps = { className?: string };

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/**
 * Social profiles. Instagram, Facebook, TikTok, and LinkedIn point at
 * the live KDER accounts; X (Twitter) is still a `#` placeholder until
 * that account is live.
 */
const SOCIAL_LINKS: {
  label: string;
  href: string;
  Icon: (props: IconProps) => ReactElement;
}[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/kder.club",
    Icon: InstagramIcon,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/194czuznYq/?mibextid=wwXIfr",
    Icon: FacebookIcon,
  },
  { label: "X", href: "#", Icon: XIcon },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@kder.club",
    Icon: TikTokIcon,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/kder-club/",
    Icon: LinkedInIcon,
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-kder-line bg-kder-cream px-5 pb-10 pt-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="max-w-md">
            <Link href="/" className="mb-5 inline-flex items-center">
              {/* Green lockup matches MarketingNav. Slightly larger
                  here since the footer has more vertical breathing
                  room. */}
              <Image
                src="/brand/lockup-green.png"
                alt="KDER"
                width={150}
                height={60}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-sm leading-relaxed text-kder-ink-muted">
              KDER connects local cooks with hungry neighbors. Share,
              find, and enjoy great homemade food.
            </p>

            <ul className="mt-6 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={`KDER on ${label}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-kder-line text-kder-ink-muted transition-colors hover:border-kder-green hover:text-kder-green active:scale-95"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-kder-ink">
                For creators
              </h4>
              <ul className="space-y-2.5 text-sm">
                {FOR_CREATORS.map((item) =>
                  item.href ? (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-kder-ink-muted transition-colors hover:text-kder-green"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ) : (
                    <li
                      key={item.label}
                      className="text-kder-ink-muted/60"
                    >
                      {item.label}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-kder-ink">
                For foodies
              </h4>
              <ul className="space-y-2.5 text-sm">
                {FOR_FOODIES.map((item) => (
                  <li
                    key={item.label}
                    className="text-kder-ink-muted/60"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start gap-3 border-t border-kder-line pt-6 text-[11px] text-kder-ink-muted/80 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} KDER. Made for your community.
          </p>
          <div className="flex gap-5">
            <Link
              href="/privacy"
              className="text-kder-ink-muted transition-colors hover:text-kder-green"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-kder-ink-muted transition-colors hover:text-kder-green"
            >
              Terms
            </Link>
            <Link
              href="/sms-policy"
              className="text-kder-ink-muted transition-colors hover:text-kder-green"
            >
              SMS Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
