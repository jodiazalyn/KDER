"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Send, Camera, ImagePlus, X } from "lucide-react";
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Two inputs: one forces the rear camera (capture="environment") for
  // snapping food / drop-off photos in the moment; one is a plain gallery
  // picker so people can also attach an existing image.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input value so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Max 5MB.");
      return;
    }

    // Replace any previously staged image (revoke the old object URL first).
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleSend = async () => {
    const body = input.trim();
    // Allow photo-only messages (no text), but never send an empty message.
    if ((!body && !mediaFile) || sending) return;

    setSending(true);

    // Upload the image first if one is staged — we need its public URL before
    // the row is inserted. The bucket-backed route keeps the chat lightweight
    // (only the URL is stored on the message).
    let mediaUrl: string | null = null;
    if (mediaFile) {
      try {
        const formData = new FormData();
        formData.append("file", mediaFile);
        const uploadRes = await fetch("/api/v1/messages/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          toast.error("Couldn't upload the photo. Try again.");
          setSending(false);
          return;
        }
        const uploadData = await uploadRes.json();
        mediaUrl = uploadData.data?.url ?? null;
      } catch {
        toast.error("Couldn't upload the photo. Check your connection.");
        setSending(false);
        return;
      }
    }

    // body is NOT NULL in the schema, so stamp a placeholder for photo-only
    // sends; the bubble hides this sentinel and shows just the image.
    const outgoingBody = body || "📷 Photo";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("messages") as any).insert({
      order_id: orderId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      body: outgoingBody,
      media_url: mediaUrl,
    });

    if (error) {
      toast.error("Couldn't send message. Try again.");
    } else {
      setInput("");
      clearMedia();
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
                  {msg.media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.media_url}
                      alt="Shared photo"
                      className="mb-1.5 h-auto max-w-full rounded-xl"
                      style={{ maxHeight: 240 }}
                      loading="lazy"
                    />
                  )}
                  {msg.body && msg.body !== "📷 Photo" && <p>{msg.body}</p>}
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

      {/* Staged-photo preview — sits directly above the input bar so the
          two read as one attachment chrome (matches the full-page thread). */}
      {mediaPreview && (
        <div className="border-t border-border px-3 pt-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaPreview}
              alt="Photo to send"
              className="h-20 w-20 rounded-xl border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearMedia}
              className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-700 shadow-lg active:scale-90 transition-transform dark:bg-red-900/40 dark:text-red-300"
              aria-label="Remove photo"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        {/* Hidden file inputs — camera capture + gallery upload. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={sending}
          className="glass-btn-pill flex h-10 w-10 flex-shrink-0 items-center justify-center text-muted-foreground active:scale-90 transition-transform disabled:opacity-50"
          aria-label="Take a photo"
        >
          <Camera size={18} />
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={sending}
          className="glass-btn-pill flex h-10 w-10 flex-shrink-0 items-center justify-center text-muted-foreground active:scale-90 transition-transform disabled:opacity-50"
          aria-label="Upload a photo"
        >
          <ImagePlus size={18} />
        </button>
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
          placeholder={mediaFile ? "Add a caption…" : "Type a message..."}
          className="glass-input h-10 min-w-0 flex-1 rounded-full px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
          aria-label="Message input"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={(!input.trim() && !mediaFile) || sending}
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
            (input.trim() || mediaFile) && !sending
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
