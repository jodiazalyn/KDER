import Link from "next/link";
import { ArrowRight, Bike, Mic, Search, Star } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";

/**
 * Drive Thru — the consumer (foodie) side of the marketplace.
 *
 * Every other section on this page sells the CREATOR side (claim a
 * handle, get paid). This one flips to the EATER: KDER's "Drive Thru"
 * voice concierge (see `src/lib/concierge/concierge-prompt.ts` +
 * `ConciergeSheet.tsx`) lets anyone in Houston just *say* what they're
 * hungry for. Drive Thru searches the WHOLE marketplace, shows real
 * orderable plates, and hands the pick to delivery or pickup. That's
 * how millions of Houston eaters reach the creators the rest of the
 * page is recruiting.
 *
 * Copy is written at a ~4th-grade reading level to match the rest of
 * the homepage: short sentences, everyday words, one idea per line.
 *
 * Light surface (kder-paper) with a mint glow — matches the other
 * "agent" moment (PricingAgentCTA / Mia) so the two AI helpers read
 * as a consistent pair. Mobile-first: copy stacks above a single
 * centered phone mock; two columns from lg.
 */

const STEPS = [
  {
    icon: Mic,
    title: "Just talk",
    body: "Say what you want, like “birria tacos” or “a vegan bowl.” No typing needed.",
  },
  {
    icon: Search,
    title: "We search KDER",
    body: "Drive Thru looks at every cook in the city and shows real plates you can order right now.",
  },
  {
    icon: Bike,
    title: "Delivered or picked up",
    body: "Pick delivery or pickup, pay in one tap, and your food is on the way.",
  },
];

/** Compact voice-chat screen shown inside the PhoneFrame. Dark chrome
 *  (the frame wraps children in `text-white`), so accents are light. */
function DriveThruPhoneScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A] px-4 pb-4 pt-9">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kder-green">
          <Mic size={14} className="text-white" />
        </span>
        <span className="text-sm font-bold text-white">Drive Thru</span>
      </div>

      {/* What the visitor says */}
      <div className="mb-3 flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-kder-green px-3 py-2 text-[13px] font-medium text-white">
          Find birria tacos, delivered 🌮
        </p>
      </div>

      {/* What Drive Thru says back */}
      <p className="mb-3 max-w-[85%] text-[13px] leading-snug text-white/70">
        Found a few near you. This one is a favorite:
      </p>

      {/* A real plate result card */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
        <div className="flex h-16 items-center justify-center bg-kder-mint">
          <span className="text-2xl">🌮</span>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-bold text-white">
              Do&ntilde;a&rsquo;s Birria Plate
            </p>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-white">
              <Star size={10} className="fill-kder-green text-kder-green" />
              4.9
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-white/50">@donaskitchen · $14</p>
          <div className="mt-3 flex h-8 items-center justify-center rounded-full bg-white text-[12px] font-bold text-kder-green">
            Deliver it
          </div>
        </div>
      </div>

      {/* Mic affordance pinned to the bottom */}
      <div className="mt-auto flex items-center justify-center gap-2 pt-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-kder-green shadow-[0_0_0_6px_rgba(27,94,32,0.25)]">
          <Mic size={18} className="text-white" />
        </span>
        <span className="text-[11px] text-white/50">Hold to talk</span>
      </div>
    </div>
  );
}

export function VoiceOrderAgent() {
  return (
    <section
      aria-labelledby="voice-agent-heading"
      className="relative overflow-hidden bg-kder-paper px-5 py-16 sm:px-6 sm:py-24 lg:py-32"
    >
      {/* Soft mint glow, same family as the Mia CTA. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 15% 0%, rgba(232,241,229,0.9) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
        {/* Left — copy */}
        <div>
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-green">
            For hungry neighbors
          </span>
          <h2
            id="voice-agent-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            Just ask. We&rsquo;ll find it.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            Meet Drive Thru, your own food helper. Tell it what you&rsquo;re
            hungry for. It looks across all of KDER, finds that dish from a
            real cook near you, and gets it delivered or ready to pick up.
            It&rsquo;s how millions of Houston neighbors order home cooking.
          </p>

          <ul className="mt-10 space-y-5">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-kder-mint text-kder-green">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-kder-ink lg:text-lg">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-kder-ink-muted">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="mt-10 inline-flex h-12 items-center gap-1.5 rounded-full bg-kder-green px-7 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-[#207024]"
          >
            Try Drive Thru
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Right — phone mock of a Drive Thru voice order. Visible on
            mobile too (centered, scaled down) so the eater story lands
            on phones, where most people will read this. */}
        <div className="relative mx-auto flex w-full max-w-[240px] justify-center sm:max-w-[280px] lg:max-w-none">
          <PhoneFrame variant="primary" className="rotate-[3deg]">
            <DriveThruPhoneScreen />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
