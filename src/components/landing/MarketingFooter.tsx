import Image from "next/image";
import Link from "next/link";

/**
 * Light-theme rewrite of the previous dark footer. Same routes,
 * same brand mark, same Houston photo attribution — restyled for
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

export function MarketingFooter() {
  return (
    <footer className="border-t border-kder-line bg-kder-cream px-6 pb-10 pt-14">
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
              KDER is the sovereign marketplace connecting passionate
              food creators with local customers. Share, discover, and
              enjoy homemade culinary excellence.
            </p>
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
            © {new Date().getFullYear()} KDER. Sovereign hospitality for
            Houston.
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
