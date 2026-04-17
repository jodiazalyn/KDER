"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/messages/ChatThread";
import { useCurrentUser } from "@/hooks/use-current-user";

const DEMO_NAMES: Record<string, string> = {
  member_demo_1: "Marcus J.",
  member_demo_2: "Tasha R.",
  member_demo_3: "Devon W.",
  member_general_1: "Keisha M.",
  member_general_2: "Andre T.",
};

export default function MessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const router = useRouter();
  const currentUser = useCurrentUser();
  const decoded = decodeURIComponent(threadId);

  // Parse threadId format: "general_{partnerId}" or "order_{orderId}_{partnerId}"
  const { partnerId, orderId, partnerName } = useMemo(() => {
    if (decoded.startsWith("order_")) {
      const parts = decoded.split("_");
      // order_{orderId}_{partnerId} — orderId may contain underscores
      const pId = parts[parts.length - 1];
      const oId = parts.slice(1, -1).join("_");
      return {
        partnerId: pId,
        orderId: oId,
        partnerName: DEMO_NAMES[pId] || `Member ${pId.slice(-4)}`,
      };
    }
    // general_{partnerId} — only strip the "general_" prefix (first occurrence)
    const pId = decoded.slice("general_".length);
    return {
      partnerId: pId,
      orderId: null,
      partnerName: DEMO_NAMES[pId] || `Member ${pId.slice(-4)}`,
    };
  }, [decoded]);

  return (
    <main className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-[#0A0A0A]/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-bold text-white">{partnerName}</h1>
          {orderId && (
            <p className="text-[10px] text-green-400/60">Order thread</p>
          )}
        </div>
      </div>

      {/* Chat */}
      <ChatThread
        partnerId={partnerId}
        partnerName={partnerName}
        currentUserId={currentUser?.id || "demo_creator"}
        orderId={orderId}
      />
    </main>
  );
}
