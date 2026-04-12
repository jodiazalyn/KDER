"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo";
import type { Message } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OrderMessagesProps {
  orderId: string;
  currentUserId: string;
  recipientId: string;
}

export function OrderMessages({
  orderId,
  currentUserId,
  recipientId,
}: OrderMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load existing messages
  const loadMessages = useCallback(async () => {
    if (isDemoMode()) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  }, [orderId, supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { loadMessages(); });
    return () => cancelAnimationFrame(frame);
  }, [loadMessages]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    if (isDemoMode()) return;

    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
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
  }, [orderId, supabase]);

  // Auto-scroll to bottom on new messages
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
      // Demo mode — add locally
      const demoMsg: Message = {
        id: `msg_${Date.now()}`,
        order_id: orderId,
        sender_id: currentUserId,
        recipient_id: recipientId,
        body,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, demoMsg]);
      setInput("");
      setSending(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("messages") as any).insert({
      order_id: orderId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      body,
    });

    if (error) {
      toast.error("Couldn't send message. Try again.");
    } else {
      setInput("");
    }

    setSending(false);
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="max-h-60 min-h-[120px] overflow-y-auto p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <p className="text-center text-xs text-white/30 py-6">
            No messages yet. Start the conversation.
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
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    isMine
                      ? "bg-green-900/[0.40] backdrop-blur-[20px] border border-green-400/[0.25] text-white"
                      : "bg-white/[0.06] backdrop-blur-[8px] border border-white/[0.12] text-white/90"
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
      <div className="flex items-center gap-2 border-t border-white/[0.08] p-3">
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
          placeholder="Type a message..."
          className="h-10 flex-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none transition-colors"
          aria-label="Message input"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90",
            input.trim() && !sending
              ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.4)]"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
