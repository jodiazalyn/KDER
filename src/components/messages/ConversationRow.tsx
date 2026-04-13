"use client";

import Link from "next/link";
import Image from "next/image";
import type { Conversation } from "@/lib/messages-store";

function shortTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(dateStr).toLocaleDateString([], { weekday: "short" });
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ConversationRowProps {
  conversation: Conversation;
}

export function ConversationRow({ conversation }: ConversationRowProps) {
  const {
    threadId,
    partnerName,
    partnerPhoto,
    lastMessage,
    lastMessageAt,
    unreadCount,
    orderId,
  } = conversation;

  const preview =
    lastMessage.length > 40
      ? lastMessage.slice(0, 40) + "..."
      : lastMessage;

  const timeAgo = shortTimeAgo(lastMessageAt);

  return (
    <Link
      href={`/messages/${encodeURIComponent(threadId)}`}
      className="flex items-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-transform"
    >
      {/* Avatar */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/[0.1]">
        {partnerPhoto ? (
          <Image
            src={partnerPhoto}
            alt={partnerName}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/40">
            {partnerName.charAt(0)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3
            className={
              unreadCount > 0
                ? "text-sm font-bold text-white"
                : "text-sm font-medium text-white/80"
            }
          >
            {partnerName}
          </h3>
          <span className="text-[10px] text-white/30 flex-shrink-0">
            {timeAgo}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between">
          <p
            className={
              unreadCount > 0
                ? "text-xs text-white/70 truncate font-medium"
                : "text-xs text-white/40 truncate"
            }
          >
            {orderId && (
              <span className="text-green-400/60 mr-1">Order ·</span>
            )}
            {preview}
          </p>

          {/* Unread dot */}
          {unreadCount > 0 && (
            <div className="ml-2 flex-shrink-0 h-2.5 w-2.5 rounded-full bg-green-400" />
          )}
        </div>
      </div>
    </Link>
  );
}
