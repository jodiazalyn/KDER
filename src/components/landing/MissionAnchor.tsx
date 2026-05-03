/**
 * Mission anchor — typography-only divider section. Mirrors Stooty's
 * "The Platform built with every creative in mind." pull-quote
 * moment, but lands on KDER's actual mission tagline.
 *
 * Sits immediately below the Hero so the scroll affordance in the
 * hero pays off here. No imagery, no buttons — the typography and
 * the words have to do all the work. Resist the urge to add
 * decorative elements that would dilute the moment.
 *
 * Anchor id `mission` lets the hero's "Scroll ↓" link target it.
 */

export function MissionAnchor() {
  return (
    <section
      id="mission"
      aria-labelledby="mission-heading"
      className="bg-kder-cream px-6 py-32 lg:py-48"
    >
      <div className="mx-auto max-w-5xl text-center">
        <span className="mb-8 inline-block text-xs font-semibold uppercase tracking-[0.32em] text-kder-green">
          Our Mission
        </span>
        <h2
          id="mission-heading"
          className="text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink sm:text-5xl lg:text-7xl"
        >
          Home chefs cooking for their neighborhood.
          <br />
          <span className="text-kder-green">
            Neighbors eating like members.
          </span>
        </h2>
      </div>
    </section>
  );
}
