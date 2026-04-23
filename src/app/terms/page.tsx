import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — KDER",
  description:
    "The rules of the road for KDER's Member-to-Member hospitality marketplace in Houston.",
};

const LAST_UPDATED = "April 23, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0A0A0A]/85 backdrop-blur-[20px]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label="KDER home"
          >
            <Image
              src="/icons/kder-logo.png"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
            <span className="text-xs font-black tracking-[0.2em] text-white">
              KDER
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <article className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <span className="mb-4 inline-block rounded-full border border-green-400/20 bg-green-900/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-300">
          Terms of Service
        </span>
        <h1 className="text-3xl font-black leading-tight tracking-[-0.02em] text-white lg:text-5xl">
          The rules of the house.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/60 lg:text-lg">
          KDER is a Member-to-Member hospitality marketplace. Every
          transaction is a service agreement between two people. These terms
          describe how that works.
        </p>
        <p className="mt-3 text-xs text-white/30">Last updated {LAST_UPDATED}</p>

        {/* Preliminary notice */}
        <div className="mt-10 rounded-2xl border border-green-400/20 bg-green-900/10 p-5 text-sm leading-relaxed text-white/70 backdrop-blur-sm">
          <p>
            <span className="font-semibold text-green-300">
              Preliminary document.
            </span>{" "}
            KDER is in private beta. Full Terms of Service will be published,
            and professionally reviewed, before public launch. By using the
            platform today you agree to these preliminary terms.
          </p>
        </div>

        <div className="mt-12 space-y-10 text-[15px] leading-relaxed text-white/75">
          <Section title="1. What KDER is">
            <p>
              KDER operates a Member-to-Member (M2M) hospitality marketplace
              that connects independent food Creators with ordering Members
              in Houston. KDER is a technology provider. We do not prepare,
              inspect, handle, deliver, or guarantee any food. Every
              transaction on KDER is structured as a service agreement
              directly between a Creator and a Member.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old to use KDER. By creating an
              account you confirm that the information you provide is
              accurate, that you have the legal right to enter into
              agreements, and that you will comply with these terms and all
              applicable laws.
            </p>
          </Section>

          <Section title="3. Accounts and handles">
            <p>
              You are responsible for the activity on your account and for
              keeping your phone number current. Your public handle
              (&quot;@yourhandle&quot;) is yours to use while your account is
              in good standing; KDER reserves the right to reclaim handles
              that impersonate others, infringe rights, or violate these
              terms.
            </p>
          </Section>

          <Section title="4. Creator obligations">
            <p>
              Creators are independent operators who sell food as a service
              directly to Members. By listing on KDER, a Creator represents
              that:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>
                They prepare food in compliance with Texas cottage food law
                (or any other applicable food-safety regime) and handle all
                food-safety responsibilities themselves.
              </li>
              <li>
                Listings are accurate — prices, quantities, ingredients,
                allergens, and availability.
              </li>
              <li>
                They will honor accepted orders, communicate changes through
                the platform, and treat Members with respect.
              </li>
              <li>
                They are responsible for their own taxes and any licenses
                required to operate in their jurisdiction.
              </li>
            </ul>
          </Section>

          <Section title="5. Member obligations">
            <p>By placing orders on KDER, Members agree to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>Provide accurate contact and delivery information.</li>
              <li>
                Pay for accepted orders and pick up or receive them as
                arranged.
              </li>
              <li>Treat Creators with respect and review honestly.</li>
              <li>
                Disclose any food allergies or dietary restrictions before
                ordering, and to rely on the Creator&apos;s listing for
                ingredient information.
              </li>
            </ul>
          </Section>

          <Section title="6. Fees and payouts">
            <p>
              Listing on KDER is always free. KDER charges a 5% platform fee
              on each completed transaction, deducted from the Creator&apos;s
              payout. Creators are paid through Stripe Connect; payouts
              typically arrive in the Creator&apos;s bank account within one
              business day after an order is marked complete. Stripe
              processing fees are covered by KDER out of the platform fee.
            </p>
          </Section>

          <Section title="7. Cancellations, refunds, and disputes">
            <p>
              Orders can be cancelled by the Creator (who may decline) or by
              mutual agreement before the order is marked ready. If an order
              cannot be fulfilled, the Member is refunded. For disputes about
              quality or delivery, Members and Creators are encouraged to
              work it out directly through the in-app messaging first. KDER
              may, at its discretion, mediate disputes and issue refunds or
              credits when appropriate.
            </p>
          </Section>

          <Section title="8. Prohibited conduct">
            <p>You may not use KDER to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>
                Sell alcohol, cannabis, controlled substances, or any
                products that are illegal to sell in Texas or the applicable
                jurisdiction.
              </li>
              <li>
                Harass, threaten, discriminate against, or impersonate anyone.
              </li>
              <li>
                Circumvent KDER&apos;s payments by taking transactions
                off-platform, or otherwise interfere with how the platform
                operates.
              </li>
              <li>
                Post false, misleading, or infringing content — including
                photos or descriptions you do not have the rights to use.
              </li>
            </ul>
          </Section>

          <Section title="9. Your content">
            <p>
              You keep the rights to the photos, videos, and descriptions you
              upload to KDER. By posting them you grant KDER a non-exclusive
              license to display, adapt, and promote that content on and
              about the platform while your account is active.
            </p>
          </Section>

          <Section title="10. Ratings and reputation">
            <p>
              After each completed order, both parties may leave a Vibe
              Rating. Ratings are used to surface high-quality Creators and
              to help keep the community accountable. KDER may remove
              ratings or reviews that violate these terms.
            </p>
          </Section>

          <Section title="11. Disclaimers">
            <p>
              KDER provides the platform on an &quot;as-is&quot; basis. We
              make no warranty about the quality, safety, or fitness of any
              food sold through KDER. All food-safety responsibilities rest
              with the Creator who prepares the food.
            </p>
          </Section>

          <Section title="12. Limitation of liability">
            <p>
              To the maximum extent permitted by law, KDER is not liable for
              any indirect, incidental, or consequential damages arising out
              of your use of the platform. Our total liability related to the
              platform is limited to the greater of $100 or the platform fees
              you paid to KDER in the 90 days before the claim arose.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You can close your account at any time. KDER may suspend or
              terminate accounts that violate these terms, behave abusively,
              or create risk for the community. Transaction records may be
              retained after termination as required by law.
            </p>
          </Section>

          <Section title="14. Governing law">
            <p>
              These terms are governed by the laws of the State of Texas,
              without regard to its conflict-of-law rules. Disputes are
              brought in the state or federal courts located in Harris
              County, Texas.
            </p>
          </Section>

          <Section title="15. SMS communications" id="sms-communications">
            <p>
              <strong className="text-white">Program name:</strong> KDER Order
              &amp; Account Alerts.
            </p>
            <p className="mt-3">
              <strong className="text-white">
                What messages you&apos;ll receive:
              </strong>{" "}
              one-time passwords (OTP) when you sign in, and notifications
              about your KDER orders — confirmations, pickup or delivery
              updates, and refund notices. We do not use SMS for marketing.
            </p>
            <p className="mt-3">
              <strong className="text-white">Message frequency:</strong>{" "}
              message frequency varies based on your activity on the platform.
              A typical order generates 3–5 transactional messages from KDER.
            </p>
            <p className="mt-3">
              <strong className="text-white">
                Message and data rates may apply.
              </strong>{" "}
              Your carrier&apos;s standard rates for messaging and data apply
              to every SMS you send or receive. KDER does not charge for SMS,
              but we are not responsible for carrier charges.
            </p>
            <p className="mt-3">
              <strong className="text-white">How to get help:</strong> Reply{" "}
              <strong className="text-white">HELP</strong> to any KDER text
              for assistance, or email us at{" "}
              <a
                href="mailto:hello@kder.club"
                className="font-medium text-green-300 underline-offset-4 hover:underline"
              >
                hello@kder.club
              </a>
              .
            </p>
            <p className="mt-3">
              <strong className="text-white">How to opt out:</strong> Reply{" "}
              <strong className="text-white">STOP</strong> to any KDER text to
              unsubscribe from all non-critical messages. One-time passwords
              required to sign in may still be delivered for account security;
              if you no longer want to receive any SMS from KDER, please close
              your account.
            </p>
            <p className="mt-3">
              <strong className="text-white">
                Consent is not a condition of purchase.
              </strong>{" "}
              You can use KDER without opting into SMS, though most
              order-status features depend on it.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              Questions? Reach us at{" "}
              <a
                href="mailto:hello@kder.club"
                className="font-medium text-green-300 underline-offset-4 hover:underline"
              >
                hello@kder.club
              </a>
              .
            </p>
          </Section>
        </div>

        {/* Bottom links */}
        <div className="mt-16 flex items-center justify-between border-t border-white/[0.06] pt-8 text-sm">
          <Link
            href="/privacy"
            className="font-medium text-green-300 transition-colors hover:text-green-200"
          >
            Read the Privacy Policy →
          </Link>
          <Link
            href="/"
            className="text-white/50 transition-colors hover:text-white"
          >
            Back to KDER
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id}>
      <h2 className="mb-3 text-lg font-bold text-white lg:text-xl">{title}</h2>
      {children}
    </section>
  );
}
