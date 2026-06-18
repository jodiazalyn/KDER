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
        className="max-h-[85vh] overflow-hidden rounded-t-3xl border-border text-foreground"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">New message</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex h-[70vh] flex-col pb-[env(safe-area-inset-bottom)]">
          {/* Real search input — pill-shaped translucent substrate
              to match iOS search bars. We use raw backdrop-filter
              instead of `glass-input` because that utility is built
              for bare <input> elements (width:100% + padding) rather
              than icon+input wrappers like this one. */}
          <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-border bg-muted/40 px-4 backdrop-blur-[16px] backdrop-saturate-[180%] focus-within:border-primary/40">
            <Search size={16} className="text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Your customers & conversations"
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              aria-label="Filter conversations"
            />
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : recipients.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
                <MessageCircleMore size={24} className="text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">No customers yet.</p>
              <p className="text-xs text-muted-foreground/60 max-w-[240px]">
                Once someone orders from your storefront, you&apos;ll be able
                to message them here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">No matches.</p>
              <p className="text-xs text-muted-foreground/60">
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
                    className="glass-card flex w-full items-center gap-3 px-3 py-3 text-left transition-all hover:bg-muted/60 active:scale-[0.99]"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-foreground/80 ring-1 ring-border overflow-hidden">
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
                            <User2 size={16} className="text-muted-foreground" />
                          )}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {r.name}
                        </span>
                        {r.hasExistingThread && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Active chat
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
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
