import { BottomNav } from "@/components/layout/BottomNav";
import { LeaderboardButtonLazy } from "@/components/dashboard/LeaderboardButtonLazy";
import { PricingCoachProvider } from "@/components/coach/PricingCoachProvider";
import { PricingCoachLauncher } from "@/components/coach/PricingCoachLauncher";
import { NewOrderBanner } from "@/components/orders/NewOrderBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The pricing-coach provider wraps the whole authed shell so any
  // descendant — pages, forms, inline triggers — can summon the
  // agent via `usePricingCoach()`. The agent component itself is
  // dynamically imported on first open, so app-shell hydration cost
  // is unchanged.
  // The app shell follows the global theme now that the dashboard is
  // restyled to light. Routes that aren't converted yet keep a temporary
  // `dark` pin via their own per-route sub-layout (e.g.
  // src/app/(app)/listings/layout.tsx) until each is restyled.
  //
  // Shared chrome (new-order banner, bottom nav, floating buttons) is still
  // styled for the dark Liquid Glass look and is shown on every route,
  // including the light dashboard. We wrap it in `dark` so it keeps its
  // existing correct appearance everywhere — no per-route seam, no
  // regression on the still-dark routes. These wrappers hold only
  // fixed/sticky elements, so they add no layout flow of their own.
  return (
    <PricingCoachProvider>
      <div className="min-h-[100dvh] bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {/* Sticky new-order alert — visible on every authed page until
            the creator triages the pending order(s). */}
        <div className="dark">
          <NewOrderBanner />
        </div>
        {children}
        <div className="dark">
          <BottomNav />
          <LeaderboardButtonLazy />
          <PricingCoachLauncher />
        </div>
      </div>
    </PricingCoachProvider>
  );
}
