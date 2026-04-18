"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, UtensilsCrossed, Loader2 } from "lucide-react";
import { PlateCard } from "@/components/listings/PlateCard";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LISTING_STATUS, type Listing, type ListingStatus } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS: { key: ListingStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];

async function patchListing(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/v1/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json.data?.listing as Listing;
}

async function postListing(body: Record<string, unknown>) {
  const res = await fetch("/api/v1/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json.data?.listing as Listing;
}

export default function ListingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ListingStatus>("active");
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuListing, setMenuListing] = useState<Listing | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/listings?mine=true");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to load listings.");
        setAll([]);
        return;
      }
      setAll((json.data?.listings ?? []) as Listing[]);
    } catch {
      setError("Failed to load listings. Check your connection.");
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const listings = all.filter((l) => l.status === activeTab);
  const allCounts: Record<string, number> = {};
  for (const tab of TABS) {
    allCounts[tab.key] = all.filter((l) => l.status === tab.key).length;
  }

  const handleAction = async (action: string) => {
    if (!menuListing) return;
    const listing = menuListing;
    setMenuListing(null);

    try {
      switch (action) {
        case "edit":
          router.push(`/listings/${listing.id}/edit`);
          return;
        case "pause":
          await patchListing(listing.id, { status: LISTING_STATUS.PAUSED });
          toast.success("Plate paused.");
          break;
        case "resume":
          await patchListing(listing.id, { status: LISTING_STATUS.ACTIVE });
          toast.success("Plate is live again!");
          break;
        case "publish":
          if (!listing.photos || listing.photos.length === 0) {
            toast.error("Add at least 1 photo before publishing.");
            return;
          }
          await patchListing(listing.id, { status: LISTING_STATUS.ACTIVE });
          toast.success("Plate published!");
          break;
        case "duplicate": {
          const payload = {
            name: `${listing.name} (Copy)`.slice(0, 60),
            description: listing.description,
            price: listing.price,
            quantity: listing.quantity,
            min_order: listing.min_order,
            photos: [...(listing.photos ?? [])],
            video: listing.video,
            fulfillment_type: listing.fulfillment_type,
            status: "draft",
            category_tags: [...(listing.category_tags ?? [])],
            allergens: [...(listing.allergens ?? [])],
          };
          await postListing(payload);
          toast.success("Plate duplicated as draft.");
          break;
        }
        case "archive":
          await patchListing(listing.id, { status: LISTING_STATUS.ARCHIVED });
          toast.success("Plate archived.");
          break;
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const totalListings = all.length;
  const isEmpty = !loading && totalListings === 0 && !error;

  return (
    <main className="relative px-4 pb-4 pt-6">
      <h1 className="text-3xl font-black text-white">Plates</h1>

      <Link
        href="/listings/new"
        className="fixed right-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/40 border border-green-400/25 backdrop-blur-[20px] text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-90 transition-transform"
        aria-label="Add new plate"
      >
        <Plus size={22} />
      </Link>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-32">
          <Loader2 size={28} className="text-white/40 animate-spin" />
          <p className="text-sm text-white/50">Loading your plates…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-32">
          <p className="text-center text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/[0.06]"
          >
            Try again
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-32">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06]">
            <UtensilsCrossed size={36} className="text-white/20" />
          </div>
          <h2 className="text-lg font-bold text-white">No plates yet</h2>
          <p className="text-center text-sm text-white/50">
            Add your first plate and start earning.
          </p>
          <Link
            href="/listings/new"
            className="mt-2 flex h-12 items-center justify-center rounded-full bg-[#1B5E20] px-8 text-sm font-bold text-white shadow-[0_0_20px_rgba(27,94,32,0.5)] active:scale-95 transition-transform"
          >
            Add Plate
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
            {TABS.map((tab) => {
              const count = allCounts[tab.key] || 0;
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
                  {count > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {listings.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {listings.map((listing) => (
                <PlateCard
                  key={listing.id}
                  listing={listing}
                  onMenuClick={setMenuListing}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 pt-20">
              <p className="text-sm text-white/40">
                No {activeTab} plates.
              </p>
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!menuListing}
        onOpenChange={(open) => {
          if (!open) setMenuListing(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white"
        >
          <SheetHeader>
            <SheetTitle className="text-white">
              {menuListing?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 pb-6">
            <MenuButton onClick={() => handleAction("edit")}>
              Edit
            </MenuButton>

            {menuListing?.status === "active" && (
              <MenuButton onClick={() => handleAction("pause")}>
                Pause
              </MenuButton>
            )}
            {menuListing?.status === "paused" && (
              <MenuButton onClick={() => handleAction("resume")}>
                Resume
              </MenuButton>
            )}
            {menuListing?.status === "draft" && (
              <MenuButton onClick={() => handleAction("publish")}>
                Publish
              </MenuButton>
            )}

            <MenuButton onClick={() => handleAction("duplicate")}>
              Duplicate
            </MenuButton>

            {menuListing?.status !== "archived" && (
              <MenuButton
                onClick={() => handleAction("archive")}
                destructive
              >
                Archive
              </MenuButton>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function MenuButton({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl px-4 py-3 text-left text-base font-medium transition-colors active:scale-[0.98]",
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-white hover:bg-white/[0.06]"
      )}
    >
      {children}
    </button>
  );
}
