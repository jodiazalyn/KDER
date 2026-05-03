import Link from "next/link";
import { HandleClaimInput } from "./HandleClaimInput";
import { ListingChip } from "./ListingChip";
import { PhoneFrame } from "./PhoneFrame";
import { SHOWCASE_LISTINGS } from "./data/showcase-listings";

/**
 * Hero — creator-first lead. Cream surface, dark headline, dark phone
 * mockups for contrast. Inspired by Stooty's hero (which uses the
 * same dark-phone-on-light pattern as the page's main visual anchor).
 *
 * Phone-mockup screenshot assets live under
 * `/public/images/landing/storefront-phone.png` and `order-phone.png`.
 * They must be added before merge — until then `<PhoneFrame>` falls
 * back to a black device with no screen content. To regenerate:
 *
 *   1. Run the storefront in dev against a curated demo handle.
 *   2. Capture iPhone-sized screenshots (390×844 @2x → 780×1688 PNG):
 *      - public storefront grid → storefront-phone.png
 *      - order-confirmation step → order-phone.png
 *   3. Optimize each to <200KB and place under
 *      `/public/images/landing/`.
 *
 * Future: a Playwright capture script could automate this — see
 * `scripts/capture-mockups.md` (TODO doc, follow-up PR).
 */

export function Hero() {
  // Pick the first showcase listing as the hero's preview teaser —
  // gives the visitor an immediate, concrete sense of what they're
  // claiming a handle for.
  const previewListing = SHOWCASE_LISTINGS[0];

  return (
    <section
      aria-label="Hero"
      className="relative overflow-hidden bg-kder-cream px-6 pb-24 pt-16 lg:pb-32 lg:pt-20"
    >
      {/* Faint warm-amber radial in the top-right — adds depth without
          competing with the headline. 15% opacity, far enough off the
          text path that it never hurts contrast. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 90% 0%, rgba(251, 191, 36, 0.18) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        {/* Left column — headline, sub-copy, claim input, listing teaser */}
        <div className="flex flex-col">
          <span className="mb-6 inline-flex w-fit items-center rounded-full bg-kder-mint px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-kder-green">
            For Houston food creators
          </span>

          <h1 className="text-6xl font-extrabold leading-[0.95] tracking-[-0.04em] text-kder-ink sm:text-7xl lg:text-9xl">
            Your kitchen.
            <br />
            Your club.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            Claim your food club. Take orders from neighbors. Keep 90% of
            every plate — no algorithm, no 30% gatekeeper, no middleman.
          </p>

          <HandleClaimInput
            theme="light"
            destination="/signup"
            className="mt-8 max-w-[520px]"
          />

          {/* Listing chip teaser — what they're really claiming */}
          <div className="mt-6 flex max-w-[520px] flex-col gap-2 rounded-2xl border border-kder-line bg-kder-paper px-5 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-kder-ink-muted">
              You&rsquo;ll show up like this
            </span>
            <ListingChip listing={previewListing} variant="compact" />
          </div>

          {/* "(scroll)" affordance — the immediate scroll payoff is the
              MissionAnchor section right below the hero. Animated bounce
              gently invites the scroll without screaming. Honors
              prefers-reduced-motion via Tailwind's motion-safe variant. */}
          <Link
            href="#mission"
            aria-label="Scroll to mission"
            className="group mt-8 inline-flex w-fit flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted transition-colors hover:text-kder-ink"
          >
            <span>Scroll</span>
            <span
              aria-hidden="true"
              className="text-base motion-safe:group-hover:translate-y-0.5 motion-safe:transition-transform"
            >
              ↓
            </span>
          </Link>
        </div>

        {/* Right column — stacked phone mockups. Hidden on mobile to
            keep the hero tight; on lg+ the dark device chrome
            provides the page's main contrast moment. */}
        <div className="relative hidden h-[600px] w-full lg:block">
          <div className="absolute left-[8%] top-[40px] z-10 w-[58%] rotate-[-6deg]">
            <PhoneFrame
              src="/images/landing/storefront-phone.png"
              alt="KDER storefront preview — a creator's plate grid"
              variant="primary"
            />
          </div>
          <div className="absolute right-[6%] top-[120px] z-0 w-[52%] rotate-[7deg]">
            <PhoneFrame
              src="/images/landing/order-phone.png"
              alt="KDER order confirmation screen"
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
