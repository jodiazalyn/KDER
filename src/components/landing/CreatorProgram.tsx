import { Sparkles, TrendingUp, Users } from "lucide-react";

/**
 * KDER's equivalent of Stooty's "Creative Network Program" section —
 * a brighter mint surface used as a visual rhythm break against the
 * cream baseline. The bullets describe a referral / shared-earnings
 * loop where existing creators bring on new ones.
 *
 * NOTE: this is product-marketing copy for a feature we plan to
 * build, not a current-day capability. Treat the section as
 * directional positioning until the referral system ships.
 *
 * The right-side dashboard mockup is intentionally NOT a live
 * component — pulling `EarningsView` into the marketing bundle would
 * blow up the route's JS payload and leak in-app concerns into the
 * public landing. Use a static PNG snapshot instead, captured the
 * same way as the hero phone mockups.
 */

export function CreatorProgram() {
  return (
    <section
      aria-labelledby="creator-program-heading"
      className="bg-kder-mint px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.22em] text-kder-green">
            Earn more by sharing
          </span>
          <h2
            id="creator-program-heading"
            className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-kder-ink lg:text-6xl"
          >
            KDER Creator Program.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-kder-ink-muted lg:text-lg">
            Refer another Houston cook to KDER. When they ship their first
            plate, you both earn. Passive income, by community.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Bring your circle",
              body: "Drop your unique referral link in the group chat. Every cook who joins becomes part of your network.",
            },
            {
              icon: TrendingUp,
              title: "Earn on every plate",
              body: "When your referrals sell, you get a share of the platform's cut — not theirs. They keep their full 90%.",
            },
            {
              icon: Sparkles,
              title: "Stack the rewards",
              body: "Hit milestone tiers (5, 10, 25 cooks) and unlock founder badges, featured placement, and bonuses.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-3xl border border-kder-green/15 bg-kder-paper p-7"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-kder-mint text-kder-green">
                <Icon size={22} strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-kder-ink lg:text-xl">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-kder-ink-muted">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
