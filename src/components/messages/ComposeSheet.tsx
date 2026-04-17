"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, User2, MessageCircleMore } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getOrders } from "@/lib/orders-store";
import { getConversations } from "@/lib/messages-store";

interface ComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

interface Recipient {
  id: string;
  name: string;
  photoUrl: string | null;
  lastOrderAmount: number | null;
  lastOrderAt: string | null;
  hasExistingThread: boolean;
  lastMessagePreview: string | null;
}

export function ComposeSheet({
  open,
  onOpenChange,
  currentUserId,
}: ComposeSheetProps) {
  const router = useRouter();

  const recipients = useMemo<Recipient[]>(() => {
    if (!open) return [];

    const byId = new Map<string, Recipient>();

    // 1. Pull unique members from past orders (creators can reach their customers)
    try {
      const orders = getOrders();
      for (const order of orders) {
        if (!order.member_id) continue;
        const existing = byId.get(order.member_id);
        const orderAt = order.created_at;
        const isNewer =
          !existing?.lastOrderAt ||
          new Date(orderAt).getTime() >
            new Date(existing.lastOrderAt).getTime();

        byId.set(order.member_id, {
          id: order.member_id,
          name: order.member_name || existing?.name || `Member`,
          photoUrl: order.member_photo || existing?.photoUrl || null,
          lastOrderAmount: isNewer
            ? order.total_amount
            : (existing?.lastOrderAmount ?? null),
          lastOrderAt: isNewer ? orderAt : (existing?.lastOrderAt ?? null),
          hasExistingThread: existing?.hasExistingThread ?? false,
          lastMessagePreview: existing?.lastMessagePreview ?? null,
        });
      }
    } catch {
      // no-op
    }

    // 2. Merge in existing conversation partners
    try {
      const { general, orders: orderThreads } = getConversations(currentUserId);
      for (const conv of [...general, ...orderThreads]) {
        const existing = byId.get(conv.partnerId);
        byId.set(conv.partnerId, {
          id: conv.partnerId,
          name: conv.partnerName || existing?.name || `Member`,
          photoUrl: conv.partnerPhoto ?? existing?.photoUrl ?? null,
          lastOrderAmount: existing?.lastOrderAmount ?? null,
          lastOrderAt: existing?.lastOrderAt ?? null,
          hasExistingThread: true,
          lastMessagePreview:
            conv.lastMessage ?? existing?.lastMessagePreview ?? null,
        });
      }
    } catch {
      // no-op
    }

    // Sort: existing threads first, then by most recent order
    return Array.from(byId.values()).sort((a, b) => {
      if (a.hasExistingThread !== b.hasExistingThread) {
        return a.hasExistingThread ? -1 : 1;
      }
      const ta = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
      const tb = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
      return tb - ta;
    });
  }, [open, currentUserId]);

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
          {/* Search placeholder (non-functional for now, visual affordance) */}
          <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4">
            <Search size={16} className="text-white/40" />
            <span className="text-sm text-white/30">
              Your customers &amp; conversations
            </span>
          </div>

          {recipients.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
                <MessageCircleMore size={24} className="text-white/30" />
              </div>
              <p className="text-sm text-white/50">
                No customers yet.
              </p>
              <p className="text-xs text-white/30 max-w-[240px]">
                Once someone orders from your storefront, you&apos;ll be able
                to message them here.
              </p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1 overflow-y-auto">
              {recipients.map((r) => (
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
                        {r.lastMessagePreview
                          ? r.lastMessagePreview
                          : r.lastOrderAmount !== null
                            ? `Last order: $${r.lastOrderAmount.toFixed(2)}`
                            : "Past customer"}
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
