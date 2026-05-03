import Image from "next/image";
import { Lock } from "lucide-react";

/**
 * Payment-methods strip — consumer-facing trust signal that lives
 * near the bottom of the marketing landing. Reassures a foodie
 * checking out a creator's storefront that paying is easy and uses
 * the same tools they already trust.
 *
 * Real polychrome official brand SVGs from /public/brand/payments/.
 * Sources:
 *   - apple-pay, google-pay, visa, mastercard, amex, discover —
 *     gilbarbara/logos GitHub repo (CC BY 4.0)
 *   - cashapp, zelle, klarna, afterpay, dinersclub —
 *     Wikimedia Commons (mostly CC BY-SA / public-domain trademark
 *     marks used here for compatibility identification)
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
  /** Brand display name — used for alt text + accessibility. */
  label: string;
  /** SVG file under /public/brand/payments/. */
  src: string;
  /** Logo intrinsic width (px). Used by next/image to compute aspect ratio. */
  width: number;
  /** Logo intrinsic height (px). */
  height: number;
}

const METHODS: MethodTileProps[] = [
  { label: "Apple Pay", src: "/brand/payments/applepay.svg", width: 60, height: 24 },
  { label: "Google Pay", src: "/brand/payments/googlepay.svg", width: 60, height: 24 },
  { label: "Cash App", src: "/brand/payments/cashapp.svg", width: 24, height: 24 },
  { label: "Zelle", src: "/brand/payments/zelle.svg", width: 60, height: 24 },
  { label: "Klarna", src: "/brand/payments/klarna.svg", width: 60, height: 24 },
  { label: "Afterpay", src: "/brand/payments/afterpay.svg", width: 80, height: 20 },
  { label: "Visa", src: "/brand/payments/visa.svg", width: 60, height: 24 },
  { label: "Mastercard", src: "/brand/payments/mastercard.svg", width: 36, height: 28 },
  { label: "American Express", src: "/brand/payments/amex.svg", width: 36, height: 28 },
  { label: "Discover", src: "/brand/payments/discover.svg", width: 80, height: 16 },
  { label: "Diners Club", src: "/brand/payments/dinersclub.svg", width: 36, height: 28 },
];

function MethodTile({ label, src, width, height }: MethodTileProps) {
  return (
    <div className="flex h-16 items-center justify-center rounded-xl border border-kder-line bg-kder-paper px-5">
      <Image
        src={src}
        alt={label}
        width={width}
        height={height}
        className="max-h-8 w-auto object-contain"
        // Marketing logos — fine to ship unoptimized; they're tiny SVGs
        // that don't benefit from Next's image pipeline anyway.
        unoptimized
      />
    </div>
  );
}

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
            <li key={method.label}>
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
