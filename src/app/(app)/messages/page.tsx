"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Mail } from "lucide-react";
import { ConversationRow } from "@/components/messages/ConversationRow";
import { getConversations, type Conversation } from "@/lib/messages-store";
import { cn } from "@/lib/utils";

type TabKey = "general" | "orders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "orders", label: "Orders" },
];

const CURRENT_USER = "demo_creator";

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [general, setGeneral] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<Conversation[]>([]);
  const [inboxActive, setInboxActive] = useState(true);

  const refresh = useCallback(() => {
    const convs = getConversations(CURRENT_USER);
    setGeneral(convs.general);
    setOrders(convs.orders);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const conversations = activeTab === "general" ? general : orders;
  const generalUnread = general.reduce((sum, c) => sum + c.unreadCount, 0);
  const ordersUnread = orders.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <main className="px-4 pb-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">Messages</h1>

        {/* Inbox toggle */}
        <button
          type="button"
          onClick={() => setInboxActive(!inboxActive)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
            inboxActive
              ? "bg-green-900/30 border border-green-400/20 text-green-300"
              : "bg-white/10 border border-white/15 text-white/50"
          )}
        >
          Inbox {inboxActive ? "On" : "Off"}
        </button>
      </div>

      {/* Paused banner */}
      {!inboxActive && (
        <div className="mt-3 rounded-xl border border-orange-400/20 bg-orange-900/20 px-4 py-2.5 text-xs text-orange-300">
          General inbox is paused — messages are queued
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
        {TABS.map((tab) => {
          const unread =
            tab.key === "general" ? generalUnread : ordersUnread;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-medium transition-all",
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

      {/* Conversation list */}
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
              No messages yet. Members can reach you from your storefront
              link.
            </p>
          ) : (
            <p className="text-center text-sm text-white/50">
              No order messages yet. They&apos;ll appear here when you
              receive orders.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
