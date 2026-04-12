"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo";
import {
  getThreadMessages,
  sendMessage as demoSendMessage,
  markThreadRead,
} from "@/lib/messages-store";
import type { Message } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatThreadProps {
  partnerId: string;
  partnerName: string;
  currentUserId: string;
  orderId?: string | null;
}

export function ChatThread({
  partnerId,
  partnerName,
  currentUserId,
  orderId,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const loadMessages = useCallback(() => {
    if (isDemoMode()) {
      const msgs = getThreadMessages(partnerId, currentUserId, orderId);
      setMessages(msgs);
      markThreadRead(partnerId, currentUserId, orderId);
      return;
    }

    // Production: load from Supabase
    const load = async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (orderId) {
        query = query.eq("order_id", orderId);
      } else {
        query = query.is("order_id", null);
      }

      const { data } = await query;
      if (data) setMessages(data as Message[]);
    };
    load();
  }, [partnerId, currentUserId, orderId, supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => loadMessages());
    return () => cancelAnimationFrame(frame);
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (isDemoMode()) return;

    const channel = supabase
      .channel(`chat-${partnerId}-${orderId || "general"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const isRelevant =
            (newMsg.sender_id === partnerId &&
              newMsg.recipient_id === currentUserId) ||
            (newMsg.sender_id === currentUserId &&
              newMsg.recipient_id === partnerId);

          if (!isRelevant) return;
          if (orderId && newMsg.order_id !== orderId) return;
          if (!orderId && newMsg.order_id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, currentUserId, orderId, supabase]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);

    if (isDemoMode()) {
      const msg = demoSendMessage(
        currentUserId,
        partnerId,
        body,
        orderId
      );
      setMessages((prev) => [...prev, msg]);
      setInput("");
      setSending(false);
      return;
    }

    // Production: send via API (will include Twilio SMS when configured)
    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: partnerId,
          body,
          order_id: orderId || null,
        }),
      });

      if (!res.ok) {
        toast.error("Couldn't send message. Try again.");
      } else {
        setInput("");
      }
    } catch {
      toast.error("Couldn't send message. Check your connection.");
    }

    setSending(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
      >
        {messages.length === 0 ? (
          <p className="text-center text-xs text-white/30 py-12">
            No messages yet. Start the conversation with {partnerName}.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isMine ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
                    isMine
                      ? "bg-green-900/[0.40] backdrop-blur-[20px] border border-green-400/[0.25] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.3)]"
                      : "bg-white/[0.06] backdrop-blur-[8px] border border-white/[0.12] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.3)]"
                  )}
                >
                  <p>{msg.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      isMine ? "text-green-300/50" : "text-white/30"
                    )}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${partnerName}...`}
            className="h-11 flex-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none transition-colors"
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
              input.trim() && !sending
                ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.4)]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
