import { BottomNav } from "@/components/layout/BottomNav";
import { LeaderboardButtonLazy } from "@/components/dashboard/LeaderboardButtonLazy";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNav />
      <LeaderboardButtonLazy />
    </div>
  );
}
