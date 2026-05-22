import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — KDER",
  description:
    "How KDER collects, uses, and protects the information of creators and members on the platform.",
};

const LAST_UPDATED = "April 29, 2026";

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

        {/* ── SMS Required Disclosure (regulatory component) ── */}
        <SmsDisclosureBox />

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
              <li>
                <span className="text-white">SMS consent records</span> —
                consent timestamp (
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] font-mono text-green-300">
                  terms_accepted_at
                </code>
                ), phone number, and account identifier, retained for
                compliance purposes.
              </li>
            </ul>
          </Section>

          <Section title="2. How we use it">
            <p>
              We use this information to run KDER — to create your account,
              power your storefront, process orders and payouts, deliver
              notifications, enforce the platform&apos;s rules, and prevent
              fraud.
            </p>
            <Highlight>
              <strong className="text-white">
                We do not sell your personal information.
              </strong>{" "}
              We do not share your mobile phone number with third parties for
              marketing or promotional purposes.
            </Highlight>
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
                <span className="text-white">Twilio</span> — phone number
                verification (OTP) and SMS notification delivery.
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
              protect the safety of our members and creators. No service
              provider listed above receives your mobile phone number for
              marketing purposes.
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
              active. Transaction records (orders, payouts, ratings) and SMS
              consent records may be retained longer to satisfy tax,
              accounting, anti-fraud, and regulatory compliance obligations.
              You can request deletion at any time — see below.
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
                Opt out of SMS messages by replying{" "}
                <strong className="text-white">STOP</strong> to any KDER
                message, or visiting{" "}
                <Link
                  href="/settings"
                  className="font-medium text-green-300 underline-offset-4 hover:underline"
                >
                  kder.club/settings
                </Link>
                .
              </li>
              <li>
                Request a copy of your data, or request deletion of your
                account, by contacting us at{" "}
                <a
                  href="mailto:privacy@kder.org"
                  className="font-medium text-green-300 underline-offset-4 hover:underline"
                >
                  privacy@kder.org
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
                href="mailto:privacy@kder.org"
                className="font-medium text-green-300 underline-offset-4 hover:underline"
              >
                privacy@kder.org
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
            href="/sms-policy"
            className="font-medium text-green-300 transition-colors hover:text-green-200"
          >
            SMS Consent Policy →
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

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-r-xl border-l-4 border-green-400 bg-green-900/15 px-5 py-4 text-sm leading-relaxed text-white/85">
      <p>{children}</p>
    </div>
  );
}

/**
 * SMS Required Disclosure — A2P 10DLC regulatory component.
 * Surfaced near the top of the policy so the program details, opt-out
 * keywords, and help keywords are visible without scrolling through the
 * full document.
 */
function SmsDisclosureBox() {
  return (
    <div className="mt-10 rounded-2xl border border-white/[0.10] bg-black/60 p-6 backdrop-blur-sm">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-green-300">
        SMS Messaging — Required Disclosure
      </p>
      <h2 className="mb-5 border-b border-white/10 pb-3 text-xl font-bold text-white">
        SMS Communications &amp; Mobile Data
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DisclosureField label="Program Name" value="KDER Alerts" />
        <DisclosureField
          label="Message Frequency"
          value="Varies based on your order activity"
        />
        <DisclosureField
          label="Support"
          value={
            <a
              href="mailto:support@kder.org"
              className="text-green-300 underline-offset-4 hover:underline"
            >
              support@kder.org
            </a>
          }
        />
        <DisclosureField
          label="SMS Consent Policy"
          value={
            <Link
              href="/sms-policy"
              className="text-green-300 underline-offset-4 hover:underline"
            >
              kder.club/sms-policy
            </Link>
          }
        />
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-[13px] leading-relaxed text-white/70">
          <strong className="text-white/95">
            KDER does not sell, rent, or share your mobile phone number with
            third parties for marketing or promotional purposes.
          </strong>{" "}
          Your phone number is used exclusively to deliver the transactional
          SMS messages described in this policy — order alerts, order
          confirmations, fulfillment updates, account notifications, and
          authentication OTPs.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          Message and data rates may apply. Message frequency varies based on
          your activity on KDER.
        </p>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
          To opt out — reply with any of these keywords
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["STOP", "CANCEL", "UNSUBSCRIBE", "END", "QUIT"].map((kw) => (
            <KwPill key={kw} tone="red">
              {kw}
            </KwPill>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/45">
          Opt-out takes effect immediately. A single confirmation is sent and
          no further messages will follow except authentication OTPs.
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
          For help — reply with any of these keywords
        </p>
        <div className="flex flex-wrap gap-1.5">
          <KwPill tone="green">HELP</KwPill>
          <KwPill tone="green">INFO</KwPill>
        </div>
        <p className="mt-2 text-xs text-white/45">
          Response: &ldquo;KDER Alerts: Get order updates &amp; notifications
          from KDER. Msg &amp; data rates may apply. Msg frequency varies.
          Reply STOP to unsubscribe. Support: support@kder.org&rdquo;
        </p>
      </div>
    </div>
  );
}

function DisclosureField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-white/85">{value}</p>
    </div>
  );
}

function KwPill({
  tone,
  children,
}: {
  tone: "red" | "green";
  children: React.ReactNode;
}) {
  const classes =
    tone === "red"
      ? "border-red-400/40 bg-red-900/25 text-red-200"
      : "border-green-400/40 bg-green-900/25 text-green-200";
  return (
    <span
      className={`inline-flex items-center rounded-md border-[1.5px] px-3 py-0.5 text-xs font-extrabold tracking-wider ${classes}`}
    >
      {children}
    </span>
  );
}
