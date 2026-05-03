import Link from "next/link";
import { ArrowRight, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { CreatorCardMockup } from "./CreatorCardMockup";

/**
 * KDER Cards — the bottom-of-page hammer. Pitches a metal debit
 * card linked directly to a creator's earnings balance, positioned
 * as the reward for top earners growing their business through
 * KDER.
 *
 * Bold KDER-green block so the card-product moment lands as the
 * page's biggest color break. The CreatorCardMockup is the visual
 * anchor.
 *
 * Note: KDER Cards is forward-looking product positioning. Stripe
 * Issuing is the mechanism — adding `card_issuing` to our existing
 * Connect account would unlock this. No "coming soon" caveat copy
 * per Jodi's preference.
 */

export function CreatorCards() {
  return (
    <section
      aria-labelledby="creator-cards-heading"
      className="relative overflow-hidden bg-kder-green px-6 py-24 text-white lg:py-32"
    >
      {/* Faint highlight band so the green doesn't read as a flat block. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.12) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left — copy + CTA */}
        <div>
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
            06 / KDER Cards
          </span>
          <h2
            id="creator-cards-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white lg:text-6xl"
          >
            Your earnings,
            <br />
            in your pocket.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 lg:text-lg">
            Top KDER creators get a metal debit card linked directly to
            their earnings balance. Restock supplies at the warehouse
            club, pay your kitchen team, or grocery on Sunday — your
            money moves the moment a plate ships.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              {
                icon: Wallet,
                title: "No payout wait",
                body: "Spend straight from your KDER balance. No 1-3 day bank transfer, no instant-payout fee.",
              },
              {
                icon: ShoppingBag,
                title: "Built for kitchens",
                body: "Every swipe categorizes automatically. Groceries, gas, supplies — your books reconcile themselves.",
              },
              {
                icon: TrendingUp,
                title: "Grow with the city",
                body: "Top earners unlock cashback on kitchen supplies and discounts with KDER's neighborhood partners.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white lg:text-lg">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="mt-10 inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-7 text-sm font-bold text-kder-green transition-transform active:scale-95 hover:bg-white/95"
          >
            Apply for a KDER Card
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Right — the metal card. Slight rotation + a soft outer
            glow gives the lift you'd expect from a glossy product
            shot, without rendering an actual product photo. */}
        <div className="relative mx-auto flex w-full justify-center lg:justify-end">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-[40px] bg-white/10 blur-3xl"
            />
            <CreatorCardMockup className="relative rotate-[-6deg]" />
          </div>
        </div>
      </div>
    </section>
  );
}
