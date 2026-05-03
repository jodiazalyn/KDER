import { Hash, ImagePlus, Wallet } from "lucide-react";

/**
 * Three-step numbered flow. Replaces the dark feature grid with a
 * cleaner Stooty-style "01 / HOW" eyebrow + numbered cards pattern.
 *
 * Each step pairs a giant ghost number (very faint mint tint) with a
 * lucide icon and a 1px green underline on the title. The ghost
 * number is the visual anchor — readable but recedes so the title
 * holds the eye.
 *
 * Anchor id `how-it-works` lets the hero's "See how it works ↓" link
 * scroll users here.
 */

interface Step {
  number: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Hash;
}

const STEPS: Step[] = [
  {
    number: "01",
    eyebrow: "Claim",
    title: "Pick @yourhandle",
    body: "We check it live as you type. Yours forever — your storefront URL becomes kder.club/@yourhandle.",
    icon: Hash,
  },
  {
    number: "02",
    eyebrow: "List",
    title: "Snap, price, publish",
    body: "Take a photo of your plate, set a price, and hit publish. You're live in 60 seconds.",
    icon: ImagePlus,
  },
  {
    number: "03",
    eyebrow: "Earn",
    title: "Get paid next day",
    body: "Customers order at your link. Stripe deposits 90% to your bank by the next business day.",
    icon: Wallet,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="bg-kder-cream px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-ink-muted">
            01 / How
          </span>
          <h2
            id="how-it-works-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            Three steps. One handle. Your food, your terms.
          </h2>
        </div>

        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map(({ number, eyebrow, title, body, icon: Icon }) => (
            <li
              key={number}
              className="relative overflow-hidden rounded-3xl border border-kder-line bg-kder-paper p-8"
            >
              {/* Giant ghost number — the section's anchor visual,
                  very faint so the title still holds the eye. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-4 -top-6 select-none text-[180px] font-extrabold leading-none text-kder-mint"
              >
                {number}
              </span>

              <div className="relative">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-kder-mint text-kder-green">
                  <Icon size={24} strokeWidth={2} />
                </div>

                <span className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-kder-green">
                  {eyebrow}
                </span>

                <h3 className="mb-3 inline-block text-xl font-bold text-kder-ink underline decoration-kder-green decoration-1 underline-offset-[6px] lg:text-2xl">
                  {title}
                </h3>

                <p className="text-sm leading-relaxed text-kder-ink-muted lg:text-base">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
