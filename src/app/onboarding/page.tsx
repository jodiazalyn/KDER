import { redirect } from "next/navigation";

/**
 * Bare `/onboarding` — entry redirect into the creator onboarding
 * wizard (profile → handle → terms).
 *
 * `/onboarding` has no screen of its own, but `/earnings` redirects a
 * creator-less user here. Without this page that redirect 404'd. Forward
 * to step 1 so no login path dead-ends. Mirrors `/onboarding/creator`.
 */
export default function OnboardingEntry() {
  redirect("/onboarding/profile");
}
