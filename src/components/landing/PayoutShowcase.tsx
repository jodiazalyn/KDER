import { Banknote, Clock3, Zap } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";
import { EarningsPhoneScreen } from "./phones/EarningsPhoneScreen";

/**
 * Payout / earnings showcase — KDER's equivalent of Stooty's twin
 * "Keep everything in one place" + "Earn additional streams of
 * income while you sleep" sections. Stooty leads with the dashboard;
 * we lead with the differentiator (90% take-rate + next-day deposits
 * + instant payouts) because that's the actual competitive story
 * vs. Linktree, IG-bio link tools, and the food-delivery majors.
 *
 * Layout: text-left, phone-mockup-right, mirroring the Hero so the
 * page has a consistent rhythm of "claim → workflow → money".
 *
 * The earnings phone screen is rendered in CSS via
 * `<EarningsPhoneScreen />` — no PNG asset required, same approach
 * as the Hero mockups.
 *
 * The 10%/90% split is the canonical platform fee — see
 * `src/app/terms/page.tsx`, `STRIPE_PLATFORM_FEE_PERCENT`, and the
 * earnings UI. If the platform fee ever changes, this copy needs
 * to change with it; consider migrating to a single source of
 * truth constant.
 */

export function PayoutShowcase() {
  return (
    <section
      aria-labelledby="payout-showcase-heading"
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
        {/* Left — copy */}
        <div>
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
            04 / Money
          </span>
          <h2
            id="payout-showcase-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            Get paid like a pro.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            KDER deposits 90% of every plate directly to your bank — usually
            by the next business day. Need it now? Push to your debit card
            in minutes. Watch your balance grow in real time, right from
            your phone.
          </p>

          {/* Three pill features — mirrors Stooty's
              Dashboard/Wallet/Transactions row but built around KDER's
              real Stripe Connect feature set. */}
          <ul className="mt-10 space-y-5">
            {[
              {
                icon: Banknote,
                title: "90% to you",
                body: "10% platform fee covers Stripe processing and keeps KDER running. No subscription, no listing fees, no hidden cuts.",
              },
              {
                icon: Clock3,
                title: "Next-day standard payouts",
                body: "Stripe Connect Express deposits sweep to your bank by the next business day. Set a weekly or daily schedule.",
              },
              {
                icon: Zap,
                title: "Instant payouts in minutes",
                body: "Push your balance to a debit card on demand. Small Stripe fee, but the cash hits in ~30 minutes — perfect for a Friday night.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-kder-mint text-kder-green">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-kder-ink lg:text-lg">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-kder-ink-muted">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — single phone mockup of the earnings UI, rendered
            in CSS via EarningsPhoneScreen. Single phone (not the
            stacked pair from the hero) keeps the visual hierarchy
            clear: hero is the page's main mockup moment, this is
            the supporting one. */}
        <div className="relative mx-auto flex w-full max-w-[320px] justify-center lg:max-w-none">
          <PhoneFrame variant="primary" className="rotate-[3deg]">
            <EarningsPhoneScreen />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
