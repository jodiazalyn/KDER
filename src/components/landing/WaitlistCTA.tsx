import { HandleClaimInput } from "./HandleClaimInput";

/**
 * Bottom-of-page hammer — the one major color break in the otherwise
 * cream/white page. A bold KDER-green block with white type makes
 * this last CTA unmissable.
 *
 * Reuses `<HandleClaimInput />` with the `on-green` theme and the
 * `/signup/waitlist` destination so the typed handle gets reserved
 * via the waitlist flow rather than dropping the visitor at the
 * standard signup OTP screen. Same `kder_onboarding_handle`
 * sessionStorage key as the hero claim — the waitlist page picks it
 * up and pre-fills the form.
 */

export function WaitlistCTA() {
  return (
    <section
      aria-labelledby="waitlist-cta-heading"
      className="bg-kder-green px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-4xl text-center">
        <span className="mb-5 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-sm">
          First 100 creators
        </span>
        <h2
          id="waitlist-cta-heading"
          className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white lg:text-6xl"
        >
          Be one of Houston&rsquo;s first 100 creators.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 lg:text-lg">
          Early creators get featured placement, free onboarding, and a
          permanent founder badge on their handle.
        </p>

        <div className="mx-auto mt-10 flex max-w-[520px] flex-col items-stretch">
          <HandleClaimInput
            theme="on-green"
            destination="/signup/waitlist"
          />
        </div>
      </div>
    </section>
  );
}
