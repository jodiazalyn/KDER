"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Camera, Check, CheckCheck, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatThreadProps {
  partnerId: string;
  partnerName: string;
  currentUserId: string;
  orderId?: string | null;
}

/* ── Helpers ── */

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - msgDay.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface MessageGroup {
  senderId: string;
  messages: Message[];
}

function groupMessages(messages: Message[]): { date: Date; groups: MessageGroup[] }[] {
  const sections: { date: Date; groups: MessageGroup[] }[] = [];

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at);
    let currentSection = sections[sections.length - 1];

    if (!currentSection || !isSameDay(currentSection.date, msgDate)) {
      currentSection = { date: msgDate, groups: [] };
      sections.push(currentSection);
    }

    const lastGroup = currentSection.groups[currentSection.groups.length - 1];
    if (lastGroup && lastGroup.senderId === msg.sender_id) {
      lastGroup.messages.push(msg);
    } else {
      currentSection.groups.push({
        senderId: msg.sender_id,
        messages: [msg],
      });
    }
  }

  return sections;
}

/* ── Typing Indicator ── */

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-white/[0.06] backdrop-blur-[8px] border border-white/[0.12] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
          <span className="h-2 w-2 rounded-full bg-white/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="h-2 w-2 rounded-full bg-white/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export function ChatThread({
  partnerId,
  partnerName,
  currentUserId,
  orderId,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Fire-and-forget: mark any unread messages from partnerId as read for this
  // user + thread. Relies on the "Recipient can mark read" RLS policy.
  const markRead = useCallback(() => {
    fetch("/api/v1/messages/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_id: partnerId, order_id: orderId ?? null }),
    }).catch(() => {
      /* best-effort; sender's UI will re-sync via Realtime UPDATE or next mount */
    });
  }, [partnerId, orderId]);

  const loadMessages = useCallback(() => {
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
      // The thread is now visible to the user — mark any unread incoming
      // messages from the partner as read.
      markRead();
    };
    load();
  }, [partnerId, currentUserId, orderId, supabase, markRead]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => loadMessages());
    return () => cancelAnimationFrame(frame);
  }, [loadMessages]);

  // Realtime subscription — listen for both INSERT and UPDATE events so the
  // sender's UI can flip from "Pending" to "Read" when the recipient opens
  // the thread (UPDATE sets messages.read_at).
  useEffect(() => {
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
            // Skip if we already have this real id.
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Reconcile optimistic row (temporary opt-* id) with the real row.
            const optIdx = prev.findIndex(
              (p) =>
                p.id.startsWith("opt-") &&
                p.sender_id === newMsg.sender_id &&
                p.recipient_id === newMsg.recipient_id &&
                p.body === newMsg.body &&
                Math.abs(
                  new Date(p.created_at).getTime() -
                    new Date(newMsg.created_at).getTime()
                ) < 10_000
            );
            if (optIdx !== -1) {
              const next = prev.slice();
              next[optIdx] = newMsg;
              return next;
            }
            return [...prev, newMsg];
          });
          // If the incoming message is from the partner, mark it read — the
          // thread is mounted and visible to this user.
          if (newMsg.sender_id === partnerId) markRead();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updated = payload.new as Message;
          const isRelevant =
            (updated.sender_id === partnerId &&
              updated.recipient_id === currentUserId) ||
            (updated.sender_id === currentUserId &&
              updated.recipient_id === partnerId);
          if (!isRelevant) return;
          if (orderId && updated.order_id !== orderId) return;
          if (!orderId && updated.order_id) return;
          // Merge server-updated fields (typically read_at) into local state
          // so the sender's "Pending" badge flips to "Read".
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, currentUserId, orderId, supabase, markRead]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, showTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, [input]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5MB.");
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    const body = input.trim();
    if ((!body && !mediaFile) || sending) return;
    setSending(true);

    let mediaUrl: string | null = null;

    // Upload media first if present. We can't optimistically render until the
    // upload finishes because we need the URL, so this stays pre-optimistic.
    if (mediaFile) {
      try {
        const formData = new FormData();
        formData.append("file", mediaFile);
        const uploadRes = await fetch("/api/v1/messages/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.data?.url || null;
        } else {
          toast.error("Failed to upload image.");
          setSending(false);
          return;
        }
      } catch {
        toast.error("Failed to upload image.");
        setSending(false);
        return;
      }
    }

    // Optimistic insert — render immediately, reconcile when server responds.
    const optimisticId = `opt-${Date.now()}`;
    const displayBody = body || "📷 Photo";
    const optimistic: Message = {
      id: optimisticId,
      order_id: orderId || null,
      sender_id: currentUserId,
      recipient_id: partnerId,
      body: displayBody,
      media_url: mediaUrl,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    clearMedia();

    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: partnerId,
          body: displayBody,
          order_id: orderId || null,
          media_url: mediaUrl,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error("Couldn't send message. Try again.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        if (!mediaFile) setInput(body);
        return;
      }

      // Swap optimistic row with the real server row as soon as it's back.
      const serverMsg: Message | undefined = json?.data?.message;
      if (serverMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === serverMsg.id)) {
            return prev.filter((m) => m.id !== optimisticId);
          }
          return prev.map((m) => (m.id === optimisticId ? serverMsg : m));
        });
      }
    } catch {
      toast.error("Couldn't send message. Check your connection.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      if (!mediaFile) setInput(body);
    }

    setSending(false);
  };

  const sections = groupMessages(messages);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
              <Send size={22} className="text-white/20 -rotate-45" />
            </div>
            <p className="text-center text-xs text-white/30">
              No messages yet. Say hello to {partnerName}.
            </p>
          </div>
        ) : (
          sections.map((section, si) => (
            <div key={si}>
              {/* Date separator */}
              <div className="flex justify-center my-4">
                <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-3 py-1 text-[11px] font-medium text-white/40 backdrop-blur-[8px]">
                  {formatDateSeparator(section.date)}
                </span>
              </div>

              {/* Message groups */}
              {section.groups.map((group, gi) => {
                const isMine = group.senderId === currentUserId;
                const isLastGroup =
                  si === sections.length - 1 &&
                  gi === section.groups.length - 1;

                return (
                  <div key={gi} className={cn("mb-1", isMine ? "items-end" : "items-start")}>
                    {group.messages.map((msg, mi) => {
                      const isFirst = mi === 0;
                      const isLast = mi === group.messages.length - 1;

                      // Bubble radius — tail on last bubble
                      const radiusClass = isMine
                        ? cn(
                            "rounded-2xl",
                            isFirst && !isLast && "rounded-br-md",
                            !isFirst && !isLast && "rounded-r-md",
                            isLast && group.messages.length > 1 && "rounded-tr-md"
                          )
                        : cn(
                            "rounded-2xl",
                            isFirst && !isLast && "rounded-bl-md",
                            !isFirst && !isLast && "rounded-l-md",
                            isLast && group.messages.length > 1 && "rounded-tl-md"
                          );

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex mb-0.5",
                            isMine ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[78%] px-3.5 py-2 text-[15px] leading-snug",
                              radiusClass,
                              isMine
                                ? "bg-green-900/[0.45] backdrop-blur-[20px] border border-green-400/[0.20] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_2px_8px_rgba(0,0,0,0.25)]"
                                : "bg-white/[0.08] backdrop-blur-[8px] border border-white/[0.10] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.25)]"
                            )}
                          >
                            {msg.media_url && (
                              <img
                                src={msg.media_url}
                                alt="Shared photo"
                                className="rounded-xl mb-1.5 max-w-full h-auto"
                                style={{ maxHeight: 240 }}
                                loading="lazy"
                              />
                            )}
                            {msg.body && msg.body !== "📷 Photo" && (
                              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Timestamp + delivery status — only on last message in group */}
                    <div
                      className={cn(
                        "flex items-center gap-1 mt-0.5 mb-3 px-1",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <span className={cn("text-[10px]", isMine ? "text-green-300/40" : "text-white/25")}>
                        {new Date(
                          group.messages[group.messages.length - 1].created_at
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>

                      {/* Delivery status for sent messages */}
                      {isMine && (
                        <span className="flex items-center gap-0.5">
                          {group.messages[group.messages.length - 1].read_at ? (
                            <CheckCheck size={12} className="text-green-400/70" />
                          ) : (
                            <Check size={12} className="text-white/30" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Typing indicator after last sent group */}
                    {isMine && isLastGroup && showTyping && (
                      <div className="mb-3">
                        <TypingIndicator />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Media preview */}
      {mediaPreview && (
        <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#1a1a1a] px-3 pt-2">
          <div className="relative inline-block">
            <img
              src={mediaPreview}
              alt="Preview"
              className="h-20 w-20 rounded-xl object-cover border border-white/[0.12]"
            />
            <button
              type="button"
              onClick={clearMedia}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
              aria-label="Remove photo"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar — iOS style */}
      <div className="flex-shrink-0 border-t border-white/[0.15] bg-[#1a1a1a] px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          {/* Camera/attachment — opens native file picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/40 mb-0.5 active:scale-90 transition-transform"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach photo"
          >
            <Camera size={18} />
          </button>

          {/* Auto-resize textarea */}
          <div className="flex-1 flex items-end rounded-[22px] border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] transition-colors focus-within:border-green-400/50 focus-within:bg-white/[0.10]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${partnerName}...`}
              rows={1}
              className="flex-1 resize-none bg-transparent px-4 py-2 text-[15px] text-white placeholder:text-white/35 focus:outline-none max-h-[100px] leading-snug"
              style={{ minHeight: "36px" }}
              aria-label="Message input"
            />
          </div>

          {/* Send button — morphs from grey to green */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full mb-0.5 transition-all duration-200 active:scale-85",
              input.trim() && !sending
                ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.5)] scale-100"
                : "bg-white/[0.08] text-white/25 scale-95"
            )}
            aria-label="Send message"
          >
            <Send size={16} className={cn(input.trim() ? "-rotate-0" : "rotate-0", "transition-transform")} />
          </button>
        </div>
      </div>
    </div>
  );
}
