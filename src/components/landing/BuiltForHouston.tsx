import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Houston anchor section — repurposes `community-houston.jpg` from
 * the previous dark landing page. In the dark version this photo
 * was the page's main image moment with a heavy green wash. In the
 * light version we lighten the treatment dramatically: the photo
 * shows through, and a translucent white card holds the copy.
 *
 * Photo attribution: Community hero photo based on Houston 2014 by
 * Katie Haugland Bowen (CC BY 2.0), adapted by KDER. The credit is
 * surfaced visibly in the marketing footer (in addition to the
 * `metadata.other` entry in `layout.tsx`).
 */

export function BuiltForHouston() {
  return (
    <section
      aria-labelledby="built-for-houston-heading"
      className="bg-kder-cream px-5 py-16 sm:px-6 sm:py-24 lg:py-32"
    >
      {/* Mobile: photo stacked ABOVE the text so nothing is clipped.
          lg: the text card floats over a full-bleed photo (the
          original overlay treatment). */}
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-kder-line bg-kder-paper sm:rounded-[40px]">
        {/* Houston photo */}
        <div className="relative aspect-[16/10] w-full sm:aspect-[16/9] lg:aspect-[16/7]">
          <Image
            src="/images/community-houston.jpg"
            alt="Houston skyline at golden hour"
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
            priority={false}
          />
          {/* Gradient blends the photo into the text: bottom-up on
              mobile (text sits below), left-to-right on lg (text
              overlays the left side). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-kder-paper via-kder-paper/30 to-transparent lg:bg-gradient-to-r lg:from-kder-cream/95 lg:via-kder-cream/60 lg:to-transparent"
          />
        </div>

        {/* Text: normal flow below the photo on mobile; absolutely
            positioned overlay card on lg. */}
        <div className="p-6 sm:p-8 lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:max-w-2xl lg:items-center lg:p-12">
          <div className="lg:rounded-3xl lg:border lg:border-kder-line lg:bg-kder-paper/85 lg:p-10 lg:shadow-[0_12px_40px_rgba(15,15,15,0.08)] lg:backdrop-blur-md">
            <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-kder-green">
              Community Choice
            </span>
            <h2
              id="built-for-houston-heading"
              className="text-2xl font-extrabold leading-[1.08] tracking-[-0.03em] text-kder-ink sm:text-3xl lg:text-5xl"
            >
              Built for Houston. Backed by the block.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-kder-ink-muted sm:mt-5 lg:text-base">
              Every order on KDER stays close to home. We started here
              because Houston cooks deserve better &mdash; not an app that
              takes 30% of every plate.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-12 items-center gap-1.5 rounded-full bg-kder-green px-7 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-[#207024] sm:mt-7"
            >
              Claim your handle
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
