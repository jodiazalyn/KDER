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
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] border border-kder-line">
        {/* Full-bleed Houston photo */}
        <div className="relative aspect-[16/9] w-full lg:aspect-[16/7]">
          <Image
            src="/images/community-houston.jpg"
            alt="Houston skyline at golden hour"
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
            priority={false}
          />
          {/* Soft cream-to-transparent gradient — much lighter than
              the previous heavy green wash. The photo carries the
              vibe; the gradient just keeps the text card legible. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-kder-cream/95 via-kder-cream/60 to-transparent"
          />
        </div>

        {/* Translucent white text card overlaid on the photo */}
        <div className="absolute inset-y-0 left-0 flex max-w-2xl items-center px-6 lg:px-12">
          <div className="rounded-3xl border border-kder-line bg-kder-paper/85 p-7 shadow-[0_12px_40px_rgba(15,15,15,0.08)] backdrop-blur-md lg:p-10">
            <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-kder-green">
              Community Choice
            </span>
            <h2
              id="built-for-houston-heading"
              className="text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-5xl"
            >
              Built for Houston. Backed by the block.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-kder-ink-muted lg:text-base">
              Every order on KDER stays in your neighborhood. We launched
              here because Houston cooks deserve a marketplace built
              for them &mdash; one that isn&rsquo;t taking 30% off the
              top of every plate.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-12 items-center gap-1.5 rounded-full bg-kder-green px-7 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-[#207024]"
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
