"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User2, MessageCircleMore, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // currentUserId retained for backward compatibility with callers; not used
  // now that data comes from the authenticated /api/v1/messages/conversations
  // endpoint which derives the current user from the session.
  currentUserId?: string;
}

interface Recipient {
  id: string;
  name: string;
  photoUrl: string | null;
  hasExistingThread: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

interface ConversationOut {
  threadId: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId: string | null;
}

export function ComposeSheet({ open, onOpenChange }: ComposeSheetProps) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Fetch real conversations whenever the sheet opens. This uses the same
  // endpoint the inbox page consumes, so the partner names come from
  // `members.display_name` (with an "Unknown" fallback server-side) — no more
  // stale "Member xxxx" strings from the old demo store.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/v1/messages/conversations");
        const json = await res.json();
        if (cancelled) return;
        const general: ConversationOut[] = json?.data?.general ?? [];
        const orders: ConversationOut[] = json?.data?.orders ?? [];

        // Dedupe by partner — if a partner has both order + general threads we
        // show a single row. Keep the entry with the newer lastMessageAt.
        const byId = new Map<string, Recipient>();
        for (const conv of [...general, ...orders]) {
          const existing = byId.get(conv.partnerId);
          const incomingAt = new Date(conv.lastMessageAt).getTime();
          const existingAt = existing?.lastMessageAt
            ? new Date(existing.lastMessageAt).getTime()
            : 0;
          if (!existing || incomingAt > existingAt) {
            byId.set(conv.partnerId, {
              id: conv.partnerId,
              name: conv.partnerName,
              photoUrl: conv.partnerPhoto,
              hasExistingThread: true,
              lastMessagePreview: conv.lastMessage,
              lastMessageAt: conv.lastMessageAt,
            });
          }
        }

        const list = Array.from(byId.values()).sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });
        setRecipients(list);
      } catch {
        if (!cancelled) setRecipients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset search when the sheet closes so the next open starts clean.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => {
      const name = r.name.toLowerCase();
      const preview = (r.lastMessagePreview ?? "").toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [recipients, query]);

  const openThread = (partnerId: string) => {
    onOpenChange(false);
    router.push(`/messages/general_${encodeURIComponent(partnerId)}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-hidden rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white">New message</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex h-[70vh] flex-col pb-[env(safe-area-inset-bottom)]">
          {/* Real search input — filters the list below by name or last-message preview. */}
          <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 focus-within:border-green-400/40">
            <Search size={16} className="text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Your customers & conversations"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
              aria-label="Filter conversations"
            />
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          ) : recipients.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
                <MessageCircleMore size={24} className="text-white/30" />
              </div>
              <p className="text-sm text-white/50">No customers yet.</p>
              <p className="text-xs text-white/30 max-w-[240px]">
                Once someone orders from your storefront, you&apos;ll be able
                to message them here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-white/50">No matches.</p>
              <p className="text-xs text-white/30">
                Try a different name or message.
              </p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1 overflow-y-auto">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openThread(r.id)}
                    aria-label={`Message ${r.name}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-900/50 to-green-700/30 text-white/80 ring-1 ring-white/10 overflow-hidden">
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold">
                          {r.name.charAt(0).toUpperCase() || (
                            <User2 size={16} className="text-white/50" />
                          )}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {r.name}
                        </span>
                        {r.hasExistingThread && (
                          <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-medium text-green-300">
                            Active chat
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-white/50">
                        {r.lastMessagePreview ?? "Past customer"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
