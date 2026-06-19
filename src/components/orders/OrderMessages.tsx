"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  // Unique per-mount suffix for the Realtime channel name. Without this,
  // Strict Mode's double-invoke + supabase's by-name channel registry can
  // leave a stale subscribed channel that the next mount picks up,
  // causing `.on()`-after-`.subscribe()` crashes.
  const instanceId = useId();

  // Load existing messages — scoped to the conversation between this
  // member and creator regardless of order_id. Both surfaces (storefront
  // chat sheet + order page thread) now show the same continuous thread,
  // so a message sent from one place appears in the other. order_id is
  // still set on inserts here for analytics, but it no longer fragments
  // the conversation.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const load = async () => {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`
          )
          .order("created_at", { ascending: true });

        if (!error && data) {
          setMessages(data as Message[]);
        }
      };
      load();
    });
    return () => cancelAnimationFrame(frame);
  }, [recipientId, currentUserId, supabase]);

  // Subscribe to new messages via Realtime — filter client-side by
  // participants since Postgres-changes filter syntax doesn't support
  // OR conditions on multiple columns.
  useEffect(() => {
    const channel = supabase
      .channel(
        `order-messages-${currentUserId}-${recipientId}-${instanceId}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const involvesMe =
            (newMsg.sender_id === currentUserId &&
              newMsg.recipient_id === recipientId) ||
            (newMsg.sender_id === recipientId &&
              newMsg.recipient_id === currentUserId);
          if (!involvesMe) return;
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
  }, [currentUserId, recipientId, supabase, instanceId]);

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
    <div className="glass-card rounded-glass-lg flex flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="max-h-60 min-h-[120px] overflow-y-auto p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground/60 py-6">
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
                    "glass-card rounded-glass max-w-[75%] px-3 py-2 text-sm",
                    isMine
                      ? "border-emerald-400/30 bg-primary/10 text-foreground"
                      : "text-foreground/80"
                  )}
                >
                  <p>{msg.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      isMine ? "text-primary/50" : "text-muted-foreground/60"
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
      <div className="flex items-center gap-2 border-t border-border p-3">
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
          className="glass-input h-10 flex-1 rounded-full px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
          aria-label="Message input"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90",
            input.trim() && !sending
              ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
              : "bg-muted text-muted-foreground/60 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
