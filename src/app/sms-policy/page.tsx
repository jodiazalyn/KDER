import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Package,
  Truck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SMS Messaging Consent & Opt-In Policy — KDER",
  description:
    "How KDER collects SMS consent, what messages we send, and how members can opt in or out at any time.",
};

const LAST_UPDATED = "April 29, 2026";

export default function SmsPolicyPage() {
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

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-green-900 via-[#0D3B14] to-[#0A0A0A]">
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center lg:py-24">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-green-300/85">
            Messaging Policy
          </p>
          <h1 className="text-3xl font-black leading-tight tracking-[-0.02em] text-white lg:text-5xl">
            SMS Messaging Consent <br className="hidden sm:block" />
            &amp; Opt-In Policy
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/65">
            How KDER collects consent from end users to receive SMS messages,
            and how users can manage their messaging preferences at any time.
          </p>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <article className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <p className="text-xs text-white/30">Last updated {LAST_UPDATED}</p>

        {/* ── Required SMS Program Disclosure (regulatory component) ── */}
        <ProgramDisclosureBox />

        <div className="mt-14 space-y-14 text-[15px] leading-relaxed text-white/75">
          {/* 1. About KDER */}
          <Section eyebrow="Overview" title="About KDER">
            <p>
              KDER is a Member-to-Member hospitality marketplace that connects
              Houston food creators with members who hire them as service
              providers. KDER sends SMS messages to facilitate order
              management, account authentication, and platform notifications
              for both Food Creators and Members.
            </p>
            <p className="mt-3">
              KDER&apos;s platform is accessible at{" "}
              <strong className="text-white">kder.club</strong>. All SMS
              communications are sent from KDER&apos;s registered phone number
              via Twilio.
            </p>
          </Section>

          {/* 2. How End Users Opt In */}
          <Section eyebrow="Consent Collection" title="How End Users Opt In">
            <p>
              End users provide explicit consent to receive SMS messages from
              KDER during the account registration process on kder.club.
              Consent is collected through the following steps:
            </p>

            <Steps
              items={[
                <>
                  The user visits{" "}
                  <strong className="text-white">kder.club</strong> and
                  initiates account creation by entering their mobile phone
                  number.
                </>,
                <>
                  KDER sends a one-time passcode (OTP) to the provided phone
                  number via SMS to verify ownership of the number.
                </>,
                <>
                  After OTP verification, the user is presented with a{" "}
                  <strong className="text-white">
                    Terms of Service acknowledgment
                  </strong>{" "}
                  containing explicit SMS consent language. This is{" "}
                  <strong className="text-white">not pre-checked</strong> —
                  the user must actively acknowledge it to proceed.
                </>,
                <>
                  The user completes account creation, confirming consent.
                </>,
                <>
                  KDER records the consent timestamp (
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] font-mono text-green-300">
                    terms_accepted_at
                  </code>
                  ) in its database, tied to the user&apos;s account and phone
                  number.
                </>,
              ]}
            />

            <Callout>
              <span className="font-semibold not-italic text-green-300">
                Consent language shown to users at registration:
              </span>
              <br />
              <br />
              &ldquo;By creating an account, you agree to KDER&apos;s Terms of
              Service and consent to receive SMS messages related to your
              orders and account activity from KDER. Message and data rates
              may apply. Message frequency varies. Reply STOP to unsubscribe
              at any time. Reply HELP for assistance.&rdquo;
            </Callout>

            <p className="mt-4">
              Food Creators who register as service providers on KDER complete
              the same account creation and consent flow, and additionally
              receive order management SMS messages as part of the Creator
              onboarding process. All consent is captured at the point of
              registration — no separate opt-in is required for any message
              type.
            </p>
          </Section>

          {/* 3. Message Types */}
          <Section eyebrow="Message Types" title="Types of SMS Messages Sent">
            <p>
              KDER sends the following categories of SMS messages to consented
              users. All messages are transactional in nature and directly
              related to the user&apos;s account activity on the platform.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MsgCard
                Icon={Lock}
                title="Authentication OTP"
                desc="One-time passcodes for account login and phone-number verification."
              />
              <MsgCard
                Icon={Package}
                title="Order Notifications"
                desc="New order alerts sent to Food Creators with order details and action prompts."
              />
              <MsgCard
                Icon={CheckCircle2}
                title="Order Confirmations"
                desc="Confirmation messages sent to Members when their order is accepted."
              />
              <MsgCard
                Icon={Truck}
                title="Fulfillment Updates"
                desc="Status updates as orders progress through preparation, pickup, or delivery."
              />
              <MsgCard
                Icon={Clock}
                title="Auto-Decline Alerts"
                desc="Notifications to Members when an order is auto-declined and a refund is issued."
              />
              <MsgCard
                Icon={BellRing}
                title="Account Alerts"
                desc="KYC status updates, payout confirmations, and platform account notices."
              />
            </div>
          </Section>

          {/* 4. Keywords */}
          <Section eyebrow="Keywords" title="Opt-In & Opt-Out Keywords">
            <p>
              KDER&apos;s primary opt-in method is web-based registration at
              kder.club, not keyword-based SMS opt-in. However, the following
              standard industry keywords are fully supported:
            </p>

            {/* Opt-in / re-subscribe block */}
            <KeywordBlock
              tone="green"
              label="Opt-In / Re-Subscribe Keywords"
              keywords={["START", "ACCEPT", "UNSTOP"]}
              note="Replying with any of these keywords re-enables messaging for users who previously opted out."
            />

            {/* Opt-out block */}
            <KeywordBlock
              tone="red"
              label="Opt-Out Keywords — reply with any of these to stop messages"
              keywords={["STOP", "CANCEL", "UNSUBSCRIBE", "END", "QUIT"]}
              note="Replying with any of these keywords immediately opts the user out of all non-authentication SMS messages. A single confirmation is sent and no further messages will follow."
            />

            {/* Help block */}
            <KeywordBlock
              tone="gray"
              label="Help Keywords"
              keywords={["HELP", "INFO"]}
              note={
                <>
                  Replying with HELP or INFO returns:{" "}
                  <em className="text-white/85">
                    &ldquo;KDER Alerts: Get order updates &amp; notifications
                    from KDER. Msg &amp; data rates may apply. Msg frequency
                    varies. Reply STOP to unsubscribe. Support:
                    support@kder.org&rdquo;
                  </em>
                </>
              }
            />
          </Section>

          {/* 5. Opt-Out Process */}
          <Section eyebrow="Opt-Out" title="How Users Opt Out">
            <p>
              Users may opt out of KDER SMS messages at any time through any
              of the following methods:
            </p>
            <Steps
              items={[
                <>
                  Reply <strong className="text-white">STOP</strong> to any
                  SMS message received from KDER. The opt-out takes effect
                  immediately.
                </>,
                <>
                  Visit{" "}
                  <Link
                    href="/settings"
                    className="font-medium text-green-300 underline-offset-4 hover:underline"
                  >
                    kder.club/settings
                  </Link>{" "}
                  and toggle SMS notifications off from account preferences.
                </>,
                <>
                  Contact KDER support directly at{" "}
                  <a
                    href="mailto:support@kder.org"
                    className="font-medium text-green-300 underline-offset-4 hover:underline"
                  >
                    support@kder.org
                  </a>{" "}
                  to request removal.
                </>,
              ]}
            />
            <p className="mt-4">
              Upon receiving a STOP reply, KDER will send a single
              confirmation message:{" "}
              <em className="text-white/90">
                &ldquo;You have been unsubscribed from KDER SMS alerts. You
                will receive no further messages. Reply START to
                re-subscribe.&rdquo;
              </em>{" "}
              No further messages will be sent except authentication OTPs
              required for account security.
            </p>
          </Section>

          {/* 6. Data & Privacy */}
          <Section eyebrow="Privacy" title="Data & Privacy">
            <p>
              KDER does not sell, share, or transfer user phone numbers or
              consent records to third parties for marketing purposes. Phone
              numbers collected during registration are used exclusively to
              deliver the transactional SMS messages described in this policy.
            </p>
            <p className="mt-3">
              Consent records — including the phone number, consent timestamp,
              and account identifier — are stored securely in KDER&apos;s
              database and retained for compliance and dispute resolution
              purposes.
            </p>
            <p className="mt-3">
              KDER&apos;s full privacy policy is available at{" "}
              <Link
                href="/privacy"
                className="font-medium text-green-300 underline-offset-4 hover:underline"
              >
                kder.club/privacy
              </Link>
              .
            </p>
          </Section>

          {/* 7. Full Consent Language */}
          <Section eyebrow="Reference" title="Full Consent Language">
            <p>
              The following is the exact SMS consent language displayed to
              users during KDER account registration, at the point of opt-in:
            </p>

            <div className="relative mt-5 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-6 pl-8">
              <span
                aria-hidden="true"
                className="absolute -top-3 left-5 font-serif text-6xl leading-none text-green-400/70"
              >
                &ldquo;
              </span>
              <p className="italic text-white/85">
                By creating an account, you agree to KDER&apos;s Terms of
                Service and consent to receive SMS messages related to your
                orders and account activity from KDER. Message and data rates
                may apply. Message frequency varies. Reply STOP to unsubscribe
                at any time. Reply HELP for assistance.
              </p>
            </div>

            <p className="mt-4">
              This consent language is displayed adjacent to an acknowledgment
              that is <strong className="text-white">not pre-checked</strong>.
              The user must actively acknowledge consent before account
              creation can be completed. Submission of the registration form
              without acknowledging this is not permitted.
            </p>
          </Section>
        </div>

        {/* Contact box */}
        <div className="mt-16 rounded-2xl border border-green-400/20 bg-green-900/20 p-8 text-center">
          <MessageSquare
            size={24}
            className="mx-auto mb-3 text-green-300"
            aria-hidden="true"
          />
          <h3 className="text-xl font-bold text-white">
            Questions about this policy?
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
            Reach our compliance team at any time.
          </p>
          <a
            href="mailto:support@kder.org"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#1B5E20] px-8 text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.4)] transition-colors hover:bg-[#2E7D32]"
          >
            support@kder.org
          </a>
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
            href="/privacy"
            className="font-medium text-green-300 transition-colors hover:text-green-200"
          >
            Privacy Policy →
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

/* ── Subcomponents ────────────────────────────────────────── */

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green-300/80">
        {eyebrow}
      </p>
      <h2 className="mb-4 border-b border-white/10 pb-3 text-xl font-bold text-white lg:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-4 divide-y divide-white/[0.06]">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-4 py-3.5 text-[15px] text-white/80"
        >
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-r-xl border-l-4 border-green-400 bg-green-900/15 px-6 py-5 text-sm italic leading-relaxed text-white/80">
      <p>{children}</p>
    </div>
  );
}

function MsgCard({
  Icon,
  title,
  desc,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
      <Icon size={20} className="mb-2 text-green-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/55">{desc}</p>
    </div>
  );
}

function KeywordPill({
  tone,
  children,
}: {
  tone: "green" | "red" | "gray";
  children: React.ReactNode;
}) {
  const classes = {
    green: "border-green-400/50 bg-green-900/25 text-green-200",
    red: "border-red-400/50 bg-red-900/25 text-red-200",
    gray: "border-white/20 bg-white/[0.06] text-white/70",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border-[1.5px] px-3.5 py-1 text-xs font-bold tracking-wider ${classes}`}
    >
      {children}
    </span>
  );
}

/**
 * Grouped keyword block used in the Keywords section. Each block has its
 * own tone and clearly labels its purpose so the regulatory intent
 * (opt-in / opt-out / help) is unambiguous.
 */
function KeywordBlock({
  tone,
  label,
  keywords,
  note,
}: {
  tone: "green" | "red" | "gray";
  label: string;
  keywords: string[];
  note: React.ReactNode;
}) {
  const containerClasses = {
    green: "border-green-400/25 bg-green-900/10",
    red: "border-red-400/25 bg-red-900/10",
    gray: "border-white/[0.10] bg-white/[0.03]",
  }[tone];
  const labelColor = {
    green: "text-green-300",
    red: "text-red-300",
    gray: "text-white/60",
  }[tone];

  return (
    <div
      className={`mt-5 rounded-xl border px-5 py-4 ${containerClasses}`}
    >
      <p
        className={`mb-3 text-[10px] font-bold uppercase tracking-[0.1em] ${labelColor}`}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <KeywordPill key={kw} tone={tone}>
            {kw}
          </KeywordPill>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/55">{note}</p>
    </div>
  );
}

/**
 * Required SMS Program Disclosure box at the top of the policy.
 * Mirrors the "program details" pattern surfaced in Privacy and
 * Terms so the regulatory boilerplate is consistent across surfaces.
 */
function ProgramDisclosureBox() {
  return (
    <div className="mt-10 rounded-2xl border border-white/[0.10] bg-black/60 p-6 backdrop-blur-sm">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-green-300">
        Required SMS Program Disclosure
      </p>
      <h2 className="mb-5 border-b border-white/10 pb-3 text-xl font-bold text-white">
        KDER SMS Program Details
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DisclosureField label="Program Name" value="KDER Alerts" />
        <DisclosureField
          label="Message Types"
          value="Order alerts, confirmations, fulfillment updates & account notifications"
        />
        <DisclosureField
          label="Message Frequency"
          value="Varies based on your order activity on KDER"
        />
        <DisclosureField
          label="Support Contact"
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
          label="Privacy Policy"
          value={
            <Link
              href="/privacy"
              className="text-green-300 underline-offset-4 hover:underline"
            >
              kder.club/privacy
            </Link>
          }
        />
        <DisclosureField
          label="Terms of Service"
          value={
            <Link
              href="/terms"
              className="text-green-300 underline-offset-4 hover:underline"
            >
              kder.club/terms
            </Link>
          }
        />
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-[13px] leading-relaxed text-white/70">
          Message and data rates may apply. Message frequency varies. KDER
          does not sell or share your mobile phone number with third parties
          for marketing purposes.
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
      <p className="mt-1 text-sm font-medium leading-relaxed text-white/85">
        {value}
      </p>
    </div>
  );
}
