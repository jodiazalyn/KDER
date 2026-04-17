import { BottomNav } from "@/components/layout/BottomNav";
import { LeaderboardButton } from "@/components/dashboard/LeaderboardButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {children}
      <BottomNav />
      <LeaderboardButton />
    </div>
  );
}
