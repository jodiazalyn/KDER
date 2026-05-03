import { Lock } from "lucide-react";

/**
 * Payment-methods strip — consumer-facing trust signal that lives
 * near the bottom of the marketing landing. Reassures a foodie
 * checking out a creator's storefront that paying is easy and uses
 * the same tools they already trust.
 *
 * Method tiles render brand text in approximate brand styling — close
 * enough to read as recognizable without shipping vendor SVG logos
 * (which are trademarked and inconsistent to maintain). If we ever
 * want pixel-perfect logos, swap each tile body for an inline SVG
 * imported from the brand's official press kit.
 *
 * The supported list (per Jodi):
 *   - Wallets: Apple Pay, Google Pay
 *   - Card networks: Visa, Mastercard, American Express, Discover,
 *     Diners Club
 *   - P2P / cash-style: Cash App, Zelle
 *   - BNPL: Klarna, Afterpay
 * Update this list if the Stripe dashboard methods change.
 */

interface MethodTileProps {
  /** The brand's display string. */
  label: string;
  /** Optional sub-label (e.g. "Pay" for Apple Pay/Google Pay). */
  sub?: string;
  /** Background color for the tile (brand color). */
  bg: string;
  /** Text color. */
  fg: string;
  /** Optional accent before/after the label (e.g. an Apple glyph). */
  prefix?: string;
}

function MethodTile({ label, sub, bg, fg, prefix }: MethodTileProps) {
  return (
    <div
      className="flex h-14 items-center justify-center gap-1.5 rounded-xl border border-kder-line px-5 font-bold tracking-tight"
      style={{ backgroundColor: bg, color: fg }}
    >
      {prefix && (
        <span className="text-base leading-none" aria-hidden="true">
          {prefix}
        </span>
      )}
      <span className="text-sm leading-none">{label}</span>
      {sub && (
        <span className="text-sm font-medium leading-none">{sub}</span>
      )}
    </div>
  );
}

const METHODS: MethodTileProps[] = [
  // Apple uses a literal Apple glyph + "Pay". Unicode  is the
  // standard Apple-logo character; renders correctly in macOS / iOS
  // Safari and as a missing-glyph box on most Linux/Android browsers.
  // Acceptable tradeoff — most KDER traffic is Apple-device anyway.
  { label: "Pay", prefix: "", bg: "#000000", fg: "#FFFFFF" },
  { label: "Pay", prefix: "G", bg: "#FFFFFF", fg: "#202124" },
  { label: "Cash App", bg: "#00D632", fg: "#000000" },
  { label: "Zelle", bg: "#6D1ED4", fg: "#FFFFFF" },
  { label: "Klarna", bg: "#FFA8CD", fg: "#17120F" },
  { label: "Afterpay", bg: "#B2FCE4", fg: "#000000" },
  { label: "VISA", bg: "#1A1F71", fg: "#FFFFFF" },
  { label: "Mastercard", bg: "#FFFFFF", fg: "#1A1F36" },
  { label: "American Express", bg: "#016FD0", fg: "#FFFFFF" },
  { label: "Discover", bg: "#FFFFFF", fg: "#FF6000" },
  { label: "Diners Club", bg: "#0079BE", fg: "#FFFFFF" },
];

export function PaymentMethods() {
  return (
    <section
      aria-labelledby="payment-methods-heading"
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
            05 / Payments
          </span>
          <h2
            id="payment-methods-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            We accept what your neighbors carry.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            Tap to pay, scan to pay, or just use your card. Every checkout
            is processed by Stripe — the same payment infrastructure
            behind Shopify, Lyft, and Instacart.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {METHODS.map((method) => (
            <li key={`${method.label}-${method.prefix ?? ""}`}>
              <MethodTile {...method} />
            </li>
          ))}
        </ul>

        <p className="mt-8 inline-flex items-center gap-2 text-xs text-kder-ink-muted">
          <Lock size={12} className="text-kder-green" />
          PCI-compliant. No card data ever touches KDER&rsquo;s servers.
        </p>
      </div>
    </section>
  );
}
