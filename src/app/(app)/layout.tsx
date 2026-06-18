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
  // `dark` pins the entire creator app shell to the original Liquid Glass
  // dark theme while light is the global default. These surfaces still use
  // hardcoded dark hex + token/glass classes; the pin keeps token-driven
  // children (glass-*, bg-card, etc.) resolving to dark so nothing mismatches.
  // Remove this `dark` class per-surface as each gets restyled to light.
  return (
    <PricingCoachProvider>
      <div className="dark min-h-[100dvh] bg-[#0A0A0A] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {/* Sticky new-order alert — visible on every authed page until
            the creator triages the pending order(s). */}
        <NewOrderBanner />
        {children}
        <BottomNav />
        <LeaderboardButtonLazy />
        <PricingCoachLauncher />
      </div>
    </PricingCoachProvider>
  );
}
