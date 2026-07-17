import { redirect } from "next/navigation";

/**
 * `/onboarding/creator` — entry redirect into the creator onboarding
 * wizard.
 *
 * There is no standalone "creator" screen: creator onboarding is the
 * 3-step wizard profile → handle → terms. But several server-side gates
 * send a logged-in user who has no `creators` row yet to this path as
 * the semantic "start becoming a creator" destination:
 *   - `requireCreator()` in src/lib/loaders/auth.ts (used by dashboard,
 *     listings, orders, and every creator-only page)
 *   - the catering surfaces (bookings, booking detail, inquiry quote)
 *
 * Before this file existed the route 404'd, so a brand-new account
 * dead-ended right after login. This forwards them to step 1 of the
 * wizard instead. Keep it a pure redirect so the wizard stays the one
 * source of truth for the actual screens.
 */
export default function CreatorOnboardingEntry() {
  redirect("/onboarding/profile");
}
