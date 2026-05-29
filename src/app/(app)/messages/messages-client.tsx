"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Mail, PenSquare } from "lucide-react";
import { ConversationRow } from "@/components/messages/ConversationRow";
import { ComposeSheet } from "@/components/messages/ComposeSheet";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";

type TabKey = "general" | "orders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "orders", label: "Orders" },
];

interface Props {
  /** Grouped general (non-order) threads, server-loaded. */
  initialGeneral: Conversation[];
  /** Grouped order threads, server-loaded. */
  initialOrders: Conversation[];
  /** Current user id, resolved server-side. ComposeSheet uses
   *  this to send "from" the right account; was previously read
   *  via `useCurrentUser()` on mount, which added a client
   *  auth roundtrip we now don't need. */
  currentUserId: string;
}

/**
 * Messages inbox client island.
 *
 * Owns: tab state, inbox toggle, compose-sheet visibility, and
 * the post-compose refresh. Data is hydrated from the server
 * page so the list renders instantly; sending a new message
 * triggers `router.refresh()` to re-pull the conversations.
 */
export function MessagesClient({
  initialGeneral,
  initialOrders,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [inboxActive, setInboxActive] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const conversations = activeTab === "general" ? initialGeneral : initialOrders;
  const generalUnread = initialGeneral.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );
  const ordersUnread = initialOrders.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );

  return (
    <main className="px-4 pb-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">Messages</h1>

        <button
          type="button"
          onClick={() => setInboxActive(!inboxActive)}
          className={cn(
            "glass-btn-pill px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
            inboxActive
              ? "bg-green-900/30 border border-green-400/25 text-green-300 shadow-[0_0_12px_rgba(27,94,32,0.30)]"
              : "text-white/50"
          )}
        >
          Inbox {inboxActive ? "On" : "Off"}
        </button>
      </div>

      {!inboxActive && (
        <div className="mt-3 rounded-xl border border-orange-400/20 bg-orange-900/20 px-4 py-2.5 text-xs text-orange-300">
          General inbox is paused — messages are queued
        </div>
      )}

      <div className="glass-segment mt-4 flex w-full gap-1 p-1">
        {TABS.map((tab) => {
          const unread =
            tab.key === "general" ? generalUnread : ordersUnread;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "glass-segment-item flex-1 py-2 text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-white/[0.12] text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              {tab.label}
              {unread > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {conversations.length > 0 ? (
        <div className="mt-4 space-y-2">
          {conversations.map((conv) => (
            <ConversationRow key={conv.threadId} conversation={conv} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 pt-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
            {activeTab === "general" ? (
              <MessageCircle size={28} className="text-white/20" />
            ) : (
              <Mail size={28} className="text-white/20" />
            )}
          </div>
          {activeTab === "general" ? (
            <p className="text-center text-sm text-white/50">
              No messages yet. Tap the compose button below to start a new
              conversation with a past customer.
            </p>
          ) : (
            <p className="text-center text-sm text-white/50">
              No order messages yet. They&apos;ll appear here when you
              receive orders.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        aria-label="New message"
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1B5E20] text-white shadow-[0_8px_28px_rgba(27,94,32,0.55)] ring-1 ring-green-400/20 transition-all hover:bg-[#207024] active:scale-90"
      >
        <PenSquare size={20} />
      </button>

      <ComposeSheet
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          // When the compose sheet closes after a send, refresh
          // the server-rendered list. (Open→close without a send
          // refreshes too, which is harmless — RSC payloads are
          // cheap.)
          if (!open) router.refresh();
        }}
        currentUserId={currentUserId}
      />
    </main>
  );
}
