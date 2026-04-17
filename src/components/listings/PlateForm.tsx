"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, Cloud, CloudOff } from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { QuantityStepper } from "./QuantityStepper";
import { FulfillmentPicker } from "./FulfillmentPicker";
import { CategoryChips } from "./CategoryChips";
import {
  CATEGORIES,
  ALLERGENS,
  LISTING_STATUS,
  type Listing,
  type FulfillmentType,
  type ListingStatus,
} from "@/types";
import { createListing, updateListing } from "@/lib/listings-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAME_MAX = 60;
const DESC_MAX = 500;
const DRAFT_KEY = "kder_plate_draft";
const AUTOSAVE_DELAY = 1500; // 1.5 seconds debounce

interface DraftData {
  name: string;
  description: string;
  price: string;
  quantity: number;
  minOrder: string;
  photos: string[];
  video: string | null;
  fulfillment: FulfillmentType;
  categories: string[];
  allergens: string[];
  savedAt: string;
}

function loadDraft(): DraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

function saveDraft(data: DraftData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}

interface PlateFormProps {
  listing?: Listing;
}

export function PlateForm({ listing }: PlateFormProps) {
  const router = useRouter();
  const isEditing = !!listing;

  // Restore draft for new plates (not edits)
  const restored = !isEditing ? loadDraft() : null;

  const [name, setName] = useState(listing?.name ?? restored?.name ?? "");
  const [description, setDescription] = useState(listing?.description ?? restored?.description ?? "");
  const [price, setPrice] = useState(listing?.price?.toString() ?? restored?.price ?? "");
  const [quantity, setQuantity] = useState(listing?.quantity ?? restored?.quantity ?? 1);
  const [minOrder, setMinOrder] = useState(listing?.min_order?.toString() ?? restored?.minOrder ?? "");
  const [photos, setPhotos] = useState<string[]>(listing?.photos ?? restored?.photos ?? []);
  const [video, setVideo] = useState<string | null>(listing?.video ?? restored?.video ?? null);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    listing?.fulfillment_type ?? restored?.fulfillment ?? "pickup"
  );
  const [categories, setCategories] = useState<string[]>(
    listing?.category_tags ?? restored?.categories ?? []
  );
  const [allergens, setAllergens] = useState<string[]>(
    listing?.allergens ?? restored?.allergens ?? []
  );
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Collapsible sections
  const [showCategories, setShowCategories] = useState(
    (listing?.category_tags?.length ?? restored?.categories?.length ?? 0) > 0
  );
  const [showAllergens, setShowAllergens] = useState(
    (listing?.allergens?.length ?? restored?.allergens?.length ?? 0) > 0
  );
  const [showMinOrder, setShowMinOrder] = useState(!!listing?.min_order || !!restored?.minOrder);

  // Auto-save with debounce (new plates only)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const doAutoSave = useCallback(() => {
    if (isEditing) return;
    const hasContent = name.trim() || description.trim() || price || photos.length > 0;
    if (!hasContent) return;

    saveDraft({
      name, description, price, quantity, minOrder,
      photos, video, fulfillment, categories, allergens,
      savedAt: new Date().toISOString(),
    });
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  }, [name, description, price, quantity, minOrder, photos, video, fulfillment, categories, allergens, isEditing]);

  useEffect(() => {
    // Skip the initial mount to avoid saving empty/restored state immediately
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (isEditing) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doAutoSave, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [name, description, price, quantity, minOrder, photos, video, fulfillment, categories, allergens, isEditing, doAutoSave]);

  const priceNum = parseFloat(price) || 0;
  const canPublish = name.trim().length > 0 && priceNum > 0 && quantity >= 1 && photos.length >= 1;
  const canDraft = name.trim().length > 0;

  const buildListingData = (status: ListingStatus) => ({
    name: name.trim(),
    description: description.trim(),
    price: priceNum,
    quantity,
    min_order: minOrder ? parseFloat(minOrder) || null : null,
    photos,
    video,
    fulfillment_type: fulfillment,
    status,
    category_tags: categories,
    allergens,
    availability_windows: listing?.availability_windows ?? [],
    discount_codes: listing?.discount_codes ?? [],
  });

  const handleSave = async (status: ListingStatus) => {
    setSaving(true);

    try {
      if (isEditing && listing) {
        updateListing(listing.id, buildListingData(status));
        toast.success(
          status === LISTING_STATUS.ACTIVE ? "Plate published!" : "Draft saved."
        );
      } else {
        createListing(buildListingData(status));
        toast.success(
          status === LISTING_STATUS.ACTIVE
            ? "Plate published! Share your link to get orders."
            : "Draft saved. Publish when you're ready."
        );
      }

      clearDraft();
      router.push("/listings");
    } catch {
      toast.error("Failed to save plate. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-[#0A0A0A]/90 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">
          {isEditing ? "Edit Plate" : "Create Plate"}
        </h1>

        {/* Auto-save indicator */}
        {!isEditing && (
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            {autoSaved ? (
              <>
                <Cloud size={14} className="text-green-400" />
                <span className="text-green-400">Saved</span>
              </>
            ) : restored ? (
              <>
                <Cloud size={14} className="text-white/30" />
                <span className="text-white/30">Draft restored</span>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Form body — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Media */}
          <section>
            <label className="mb-2 block text-sm font-medium text-white/60">
              Photos &amp; Video
            </label>
            <MediaUpload
              photos={photos}
              video={video}
              onPhotosChange={setPhotos}
              onVideoChange={setVideo}
            />
          </section>

          {/* Name */}
          <section>
            <label
              htmlFor="plate-name"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Plate name *
            </label>
            <input
              id="plate-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              placeholder="e.g., Smoked Brisket Plate"
              className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {name.length}/{NAME_MAX}
            </p>
          </section>

          {/* Description */}
          <section>
            <label
              htmlFor="plate-desc"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Description
            </label>
            <textarea
              id="plate-desc"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, DESC_MAX))
              }
              placeholder="What makes this plate special?"
              rows={3}
              className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors resize-none"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {description.length}/{DESC_MAX}
            </p>
          </section>

          {/* Price */}
          <section>
            <label
              htmlFor="plate-price"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Price *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-green-300">
                $
              </span>
              <input
                id="plate-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d.]/g, "");
                  if (val.split(".").length <= 2) setPrice(val);
                }}
                placeholder="0.00"
                className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] pl-10 pr-4 text-lg font-bold text-green-300 placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
              />
            </div>
          </section>

          {/* Quantity */}
          <section>
            <label className="mb-2 block text-sm font-medium text-white/60">
              Quantity available *
            </label>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </section>

          {/* Fulfillment */}
          <section>
            <label className="mb-2 block text-sm font-medium text-white/60">
              Fulfillment
            </label>
            <FulfillmentPicker value={fulfillment} onChange={setFulfillment} />
          </section>

          {/* Collapsible: Categories */}
          <CollapsibleSection
            title="Category tags"
            open={showCategories}
            onToggle={() => setShowCategories(!showCategories)}
          >
            <CategoryChips
              options={CATEGORIES}
              selected={categories}
              onChange={setCategories}
              label="Category tags"
            />
          </CollapsibleSection>

          {/* Collapsible: Allergens */}
          <CollapsibleSection
            title="Allergen flags"
            open={showAllergens}
            onToggle={() => setShowAllergens(!showAllergens)}
          >
            <CategoryChips
              options={ALLERGENS}
              selected={allergens}
              onChange={setAllergens}
              label="Allergen flags"
            />
          </CollapsibleSection>

          {/* Collapsible: Minimum order */}
          <CollapsibleSection
            title="Minimum order amount"
            open={showMinOrder}
            onToggle={() => setShowMinOrder(!showMinOrder)}
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/40">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={minOrder}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d.]/g, "");
                  if (val.split(".").length <= 2) setMinOrder(val);
                }}
                placeholder="No minimum"
                className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] pl-10 pr-4 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Sticky bottom action bar — sits above the bottom nav */}
      <div className="fixed bottom-20 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            type="button"
            onClick={() => handleSave(LISTING_STATUS.DRAFT)}
            disabled={!canDraft || saving}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-full border text-sm font-bold transition-all active:scale-95",
              canDraft && !saving
                ? "border-white/25 text-white hover:bg-white/[0.08]"
                : "border-white/10 text-white/30 cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save as Draft"}
          </button>

          <button
            type="button"
            onClick={() => handleSave(LISTING_STATUS.ACTIVE)}
            disabled={!canPublish || saving}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-full text-sm font-bold text-white transition-all active:scale-95",
              canPublish && !saving
                ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
                : "bg-white/10 cursor-not-allowed opacity-50"
            )}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Collapsible Section ---

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white/60 hover:text-white/80"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          size={16}
          className={cn(
            "transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
