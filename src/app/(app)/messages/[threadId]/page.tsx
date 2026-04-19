"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/messages/ChatThread";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";

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
  const { partnerId, orderId } = useMemo(() => {
    if (decoded.startsWith("order_")) {
      const parts = decoded.split("_");
      // order_{orderId}_{partnerId} — orderId may contain underscores
      const pId = parts[parts.length - 1];
      const oId = parts.slice(1, -1).join("_");
      return { partnerId: pId, orderId: oId };
    }
    // general_{partnerId} — only strip the "general_" prefix (first occurrence)
    return {
      partnerId: decoded.slice("general_".length),
      orderId: null as string | null,
    };
  }, [decoded]);

  // Fetch the partner's real display_name from the members table. Previously
  // this page derived a "Member {uuid-suffix}" string from the URL slug, which
  // showed up in the chat header and input placeholder. We now hydrate from
  // the DB so creators see the actual customer's name.
  const [partnerName, setPartnerName] = useState<string>("");
  useEffect(() => {
    if (!partnerId) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = (await (supabase as any)
        .from("members")
        .select("display_name")
        .eq("id", partnerId)
        .maybeSingle()) as { data: { display_name: string } | null };
      if (cancelled) return;
      if (data?.display_name) setPartnerName(data.display_name);
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

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
          <h1 className="text-base font-bold text-white">
            {partnerName || "…"}
          </h1>
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
