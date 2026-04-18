import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — KDER",
  description:
    "How KDER collects, uses, and protects the information of creators and members on the platform.",
};

const LAST_UPDATED = "April 18, 2026";

export default function PrivacyPage() {
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
          Privacy Policy
        </span>
        <h1 className="text-3xl font-black leading-tight tracking-[-0.02em] text-white lg:text-5xl">
          Your data, respected.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/60 lg:text-lg">
          KDER is built on sovereignty — yours. This page explains what we
          collect, why, and the choices you have.
        </p>
        <p className="mt-3 text-xs text-white/30">Last updated {LAST_UPDATED}</p>

        {/* Preliminary notice */}
        <div className="mt-10 rounded-2xl border border-green-400/20 bg-green-900/10 p-5 text-sm leading-relaxed text-white/70 backdrop-blur-sm">
          <p>
            <span className="font-semibold text-green-300">
              Preliminary document.
            </span>{" "}
            KDER is in private beta. This policy will be expanded and
            professionally reviewed before public launch. By using the
            platform today, you agree to these preliminary terms.
          </p>
        </div>

        <div className="mt-12 space-y-10 text-[15px] leading-relaxed text-white/75">
          <Section title="1. What we collect">
            <p>
              When you sign up for KDER we collect the information you give us
              directly and a small amount of information about how you use the
              platform:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>
                <span className="text-white">Account details</span> — phone
                number, display name, handle, profile photo, bio.
              </li>
              <li>
                <span className="text-white">Creator details</span> — legal
                name, date of birth, service area zip codes, pickup address,
                and identity information required by Stripe for payouts.
              </li>
              <li>
                <span className="text-white">Marketplace activity</span> —
                plate listings, orders, messages, ratings, and payout history.
              </li>
              <li>
                <span className="text-white">Device &amp; usage data</span> —
                basic technical information (IP address, browser, session
                events) used to keep the platform secure and reliable.
              </li>
            </ul>
          </Section>

          <Section title="2. How we use it">
            <p>
              We use this information to run KDER — to create your account,
              power your storefront, process orders and payouts, deliver
              notifications, enforce the platform&apos;s rules, and prevent
              fraud. We do not sell your personal information.
            </p>
          </Section>

          <Section title="3. Who we share it with">
            <p>
              KDER relies on a small set of trusted service providers. Each
              receives only the data it needs to do its job:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>
                <span className="text-white">Supabase</span> — database,
                authentication, and file storage.
              </li>
              <li>
                <span className="text-white">Stripe</span> — payments, Connect
                payouts, and identity verification for creators.
              </li>
              <li>
                <span className="text-white">Twilio</span> — phone
                verification and SMS notifications.
              </li>
              <li>
                <span className="text-white">Cloudinary</span> — image and
                video hosting for plate photos.
              </li>
              <li>
                <span className="text-white">OneSignal</span> — push and SMS
                notification delivery.
              </li>
              <li>
                <span className="text-white">Vercel / Netlify</span> — hosting
                and application delivery.
              </li>
            </ul>
            <p className="mt-4">
              We may also disclose information when required by law or to
              protect the safety of our members and creators.
            </p>
          </Section>

          <Section title="4. What Creators and Members see of each other">
            <p>
              When an order is placed, the Creator and Member share a minimal
              amount of information required to complete the service — name,
              phone, and the delivery or pickup address relevant to that
              order. Creators do not receive payment card numbers. Pickup
              addresses are only revealed to a Member after the Creator
              accepts their order.
            </p>
          </Section>

          <Section title="5. How long we keep it">
            <p>
              We keep your account information for as long as your account is
              active. Transaction records (orders, payouts, ratings) may be
              retained longer to satisfy tax, accounting, and anti-fraud
              obligations. You can request deletion at any time — see below.
            </p>
          </Section>

          <Section title="6. Your choices">
            <p>You can, at any time:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
              <li>Update your profile information from your dashboard.</li>
              <li>Pause your storefront if you&apos;re a Creator.</li>
              <li>
                Turn off your inbox to stop receiving new messages from
                strangers.
              </li>
              <li>
                Request a copy of your data, or request deletion of your
                account, by contacting us at{" "}
                <a
                  href="mailto:privacy@kder.club"
                  className="font-medium text-green-300 underline-offset-4 hover:underline"
                >
                  privacy@kder.club
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="7. Children">
            <p>
              KDER is not intended for anyone under 18. We do not knowingly
              collect information from children. If you believe a minor has
              created an account, let us know and we&apos;ll remove it.
            </p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>
              As KDER grows we may update this policy. When we do, we&apos;ll
              update the &quot;last updated&quot; date at the top of the page
              and, for material changes, notify you through the app.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              Questions about privacy or your data? Email us at{" "}
              <a
                href="mailto:privacy@kder.club"
                className="font-medium text-green-300 underline-offset-4 hover:underline"
              >
                privacy@kder.club
              </a>
              .
            </p>
          </Section>
        </div>

        {/* Bottom links */}
        <div className="mt-16 flex items-center justify-between border-t border-white/[0.06] pt-8 text-sm">
          <Link
            href="/terms"
            className="font-medium text-green-300 transition-colors hover:text-green-200"
          >
            Read the Terms of Service →
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-white lg:text-xl">{title}</h2>
      {children}
    </section>
  );
}
