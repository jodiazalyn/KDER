/**
 * Profile-circle quote row — Stooty-style.
 *
 * IMPORTANT: the three quotes below are PLACEHOLDERS. They must be
 * replaced with real, sign-off-cleared testimonials from actual
 * KDER beta creators before this section ships. Do not merge with
 * the placeholders intact.
 *
 * If real quotes aren't ready by merge time, omit `<Testimonials />`
 * from the page composition in `src/app/page.tsx` for v1 and add
 * back later. Per Jodi's anti-fakery principle (we already retired
 * the synthetic LiveUserTicker for the same reason), fabricated
 * testimonials are off-limits.
 */

interface Testimonial {
  quote: string;
  name: string;
  neighborhood: string;
}

// TODO: replace with real testimonials before merge.
const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Finally — a link I can put in my IG bio that actually takes orders.",
    name: "Marisol",
    neighborhood: "Sharpstown",
  },
  {
    quote: "Made my rent two weekends in a row.",
    name: "DJ",
    neighborhood: "Third Ward",
  },
  {
    quote:
      "My regulars now have one place to find me. Game changer.",
    name: "Tia",
    neighborhood: "EaDo",
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
            03 / Voices
          </span>
          <h2
            id="testimonials-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            What creators are saying.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLACEHOLDER_TESTIMONIALS.map((t) => (
            <li
              key={t.name}
              className="flex flex-col gap-5 rounded-3xl border border-kder-line bg-kder-paper p-7"
            >
              <p className="text-base leading-relaxed text-kder-ink lg:text-lg">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kder-mint text-sm font-bold text-kder-green">
                  {initials(t.name)}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-kder-ink">{t.name}</p>
                  <p className="text-xs text-kder-ink-muted">
                    {t.neighborhood}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
