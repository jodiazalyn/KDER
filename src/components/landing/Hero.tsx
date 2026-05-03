import { HandleClaimInput } from "./HandleClaimInput";
import { PhoneFrame } from "./PhoneFrame";
import { OrderPhoneScreen } from "./phones/OrderPhoneScreen";
import { StorefrontPhoneScreen } from "./phones/StorefrontPhoneScreen";

/**
 * Hero — creator-first lead. Cream surface, dark headline, dark phone
 * mockups for contrast. Inspired by Stooty's hero (which uses the
 * same dark-phone-on-light pattern as the page's main visual anchor).
 *
 * The phone screens are rendered in CSS via `<StorefrontPhoneScreen
 * />` and `<OrderPhoneScreen />` — no PNG assets required. This
 * matches Stooty's actual approach (their phone mockups are
 * designed UI, not raw captures) and means the marketing page
 * never has stale or missing screenshots.
 *
 * No explicit scroll affordance — the MissionAnchor's giant
 * typography immediately below does the scroll-cue work via design,
 * not via an explicit "Scroll ↓" label. Same logic on the listing
 * chip preview that used to live below the input — the right-column
 * StorefrontPhoneScreen already shows the visitor what they're
 * claiming, so a duplicate one-line preview was redundant.
 */

export function Hero() {
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
        {/* Left column — headline, sub-copy, claim input */}
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
            every plate — no algorithm.
          </p>

          <HandleClaimInput
            theme="light"
            destination="/signup"
            className="mt-8 max-w-[520px]"
          />
        </div>

        {/* Right column — stacked phone mockups rendered entirely in
            CSS via the StorefrontPhoneScreen / OrderPhoneScreen
            components. Hidden on mobile to keep the hero tight; on
            lg+ the dark device chrome provides the page's main
            contrast moment against the cream surface. */}
        <div className="relative hidden h-[600px] w-full lg:block">
          <div className="absolute left-[8%] top-[40px] z-10 w-[58%] rotate-[-6deg]">
            <PhoneFrame variant="primary">
              <StorefrontPhoneScreen />
            </PhoneFrame>
          </div>
          <div className="absolute right-[6%] top-[120px] z-0 w-[52%] rotate-[7deg]">
            <PhoneFrame variant="secondary">
              <OrderPhoneScreen />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
