/**
 * Credibility bar — replaces the synthetic LiveUserTicker. Stooty
 * uses a "Trusted by world-class creators" line at the bottom of the
 * hero; we adapt that to a neighborhood marquee that signals
 * Houston-specific reach without fabricating numbers.
 *
 * CSS-only marquee (uses the `animate-marquee` keyframe defined in
 * tailwind.config.ts). Content is duplicated 2x inside the wrapper
 * so the -50% translate loops seamlessly.
 *
 * Honors prefers-reduced-motion via Tailwind's `motion-safe` /
 * `motion-reduce` variants — for users with reduced motion the row
 * just renders static.
 */

const NEIGHBORHOODS = [
  "Third Ward",
  "Alief",
  "EaDo",
  "Sharpstown",
  "Spring Branch",
  "Gulfton",
  "Sunnyside",
  "Acres Homes",
  "Greater Heights",
  "Montrose",
  "Northside",
  "Pearland",
];

export function TrustStrip() {
  // Two passes of the same array, duplicated, so the marquee loops
  // without a visible seam.
  const items = [...NEIGHBORHOODS, ...NEIGHBORHOODS];

  return (
    <section
      aria-label="Trusted by Houston's home-kitchen community"
      className="border-y border-kder-line bg-kder-cream py-8"
    >
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
        Trusted by Houston&rsquo;s home-kitchen community
      </p>
      <div
        className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]"
        // Hide the marquee from screen readers — the heading above
        // already conveys the meaning.
        aria-hidden="true"
      >
        <div className="flex w-max gap-12 motion-safe:animate-marquee motion-reduce:animate-none">
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] text-kder-ink-muted"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
