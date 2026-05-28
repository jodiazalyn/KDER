"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Loader2, Cloud, CloudOff } from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { QuantityStepper } from "./QuantityStepper";
import { FulfillmentPicker } from "./FulfillmentPicker";
import { CategoryChips } from "./CategoryChips";
import { AiDraftButton } from "@/components/shared/AiDraftButton";
import { Coachmark } from "@/components/ui/coachmark";
import { InfoTip } from "@/components/ui/info-tip";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { COACHMARK_COPY, isCoachmarkDismissed } from "@/lib/coachmarks";
import {
  CATEGORIES,
  ALLERGENS,
  LISTING_STATUS,
  type Listing,
  type ListingKind,
  type CateringPricingMode,
  type CateringFulfillment,
  type CateringInclusionGroups,
  type FulfillmentType,
  type ListingStatus,
} from "@/types";
import { CateringInclusionsEditor } from "./CateringInclusionsEditor";
import { AskCoachInline } from "@/components/coach/AskCoachInline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAME_MAX = 60;
const DESC_MAX = 500;
const DRAFT_KEY = "kder_plate_draft";
const AUTOSAVE_DELAY = 1500; // 1.5 seconds debounce

interface DraftData {
  kind?: ListingKind; // Optional for back-compat with old drafts (defaults to 'plate').
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
  // Catering-only — only set when kind='catering'.
  cateringPricingMode?: CateringPricingMode;
  cateringMinGuests?: string;
  cateringMaxGuests?: string;
  cateringLeadTimeHours?: string;
  cateringFulfillment?: CateringFulfillment[];
  cateringInclusions?: string;
  cateringInclusionGroups?: CateringInclusionGroups;
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

/** Build a contextual seed prompt for the Pricing Coach based on what
 *  the creator has typed so far. Used by the inline "Ask the coach"
 *  triggers in the price section. Short and natural — the user can
 *  edit before sending. */
function buildPriceCoachSeed({
  kind,
  name,
  description,
  cateringPricingMode,
}: {
  kind: "plate" | "catering";
  name: string;
  description: string;
  cateringPricingMode?: "per_head" | "flat";
}): string {
  const trimmedName = name.trim();
  const trimmedDesc = description.trim().slice(0, 200);

  if (kind === "plate") {
    if (trimmedName && trimmedDesc) {
      return `What should I charge per plate for "${trimmedName}"? It's ${trimmedDesc}`;
    }
    if (trimmedName) {
      return `What should I charge per plate for "${trimmedName}"?`;
    }
    return "Help me figure out a fair price per plate for what I'm making. I'll tell you the dish.";
  }

  // catering
  const modeHint =
    cateringPricingMode === "flat"
      ? "as a flat package price"
      : "per head (per guest)";
  if (trimmedName && trimmedDesc) {
    return `Help me price "${trimmedName}" ${modeHint}. It's ${trimmedDesc}`;
  }
  if (trimmedName) {
    return `Help me price "${trimmedName}" ${modeHint}.`;
  }
  return `Help me figure out a fair catering price ${modeHint}. I'll tell you what I'm making.`;
}

interface PlateFormProps {
  listing?: Listing;
}

export function PlateForm({ listing }: PlateFormProps) {
  const router = useRouter();
  const isEditing = !!listing;

  // Restore draft for new plates (not edits)
  const restored = !isEditing ? loadDraft() : null;

  // Coachmark targets — first-time tips fire only when this PlateForm is
  // creating a new plate (not editing an existing one) so we don't nag
  // experienced creators editing their menu.
  const nameCoachRef = useRef<HTMLInputElement>(null);
  const photosCoachRef = useRef<HTMLDivElement>(null);
  const priceCoachRef = useRef<HTMLDivElement>(null);
  // Coachmark anchor for the catering kind toggle — first-time-only.
  const cateringKindCoachRef = useRef<HTMLDivElement>(null);
  // Sequence: photos tip first, then name, then price. Each tip only
  // renders once the previous has been dismissed (this session OR
  // persistent). Prevents simultaneous coachmark spotlights.
  const [photosCoachDone, setPhotosCoachDone] = useState<boolean>(() =>
    isCoachmarkDismissed("creator-plate-photos")
  );
  const [nameCoachDone, setNameCoachDone] = useState<boolean>(() =>
    isCoachmarkDismissed("creator-plate-title")
  );

  // Listing kind: 'plate' is on-demand checkout, 'catering' is the
  // advance-booking + inquiry/quote/deposit flow shipped in PR 2-4.
  // Existing listings default to 'plate' (the DB column has the same
  // default), so this form is fully backward-compat.
  const [kind, setKind] = useState<ListingKind>(
    listing?.kind ?? restored?.kind ?? "plate"
  );

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

  // ── Catering-only state ─────────────────────────────────────────
  // All ignored when kind='plate'. The DB-level CHECK constraint
  // (listings_catering_required_fields) only enforces these when
  // kind='catering', so plates can keep saving with all of these null.
  const [cateringPricingMode, setCateringPricingMode] = useState<CateringPricingMode>(
    listing?.catering_pricing_mode ?? restored?.cateringPricingMode ?? "per_head"
  );
  const [cateringMinGuests, setCateringMinGuests] = useState(
    listing?.catering_min_guests?.toString() ?? restored?.cateringMinGuests ?? "10"
  );
  const [cateringMaxGuests, setCateringMaxGuests] = useState(
    listing?.catering_max_guests?.toString() ?? restored?.cateringMaxGuests ?? ""
  );
  // Lead time is stored as a single hours int in the DB but presented as
  // days + leftover hours in the UI — "2 days, 0 hours" is way easier to
  // reason about than "48 hours". The two pieces of state stay in sync
  // through buildListingData (combines them) and the initial-value
  // expressions below (decomposes the existing listing's stored hours).
  const initialLeadHours =
    listing?.catering_lead_time_hours ??
    (restored?.cateringLeadTimeHours
      ? parseInt(restored.cateringLeadTimeHours, 10) || 48
      : 48);
  const [cateringLeadDays, setCateringLeadDays] = useState(
    Math.floor(initialLeadHours / 24).toString()
  );
  const [cateringLeadHoursPart, setCateringLeadHoursPart] = useState(
    (initialLeadHours % 24).toString()
  );
  const [cateringFulfillment, setCateringFulfillment] = useState<CateringFulfillment[]>(
    listing?.catering_fulfillment ?? restored?.cateringFulfillment ?? ["pickup", "delivery"]
  );
  // Free-text inclusions kept for back-compat with listings created
  // before the structured editor shipped. The form prefers
  // cateringInclusionGroups (below) when both are set.
  const [cateringInclusions, setCateringInclusions] = useState(
    listing?.catering_inclusions ?? restored?.cateringInclusions ?? ""
  );
  const [cateringInclusionGroups, setCateringInclusionGroups] = useState<CateringInclusionGroups>(
    listing?.catering_inclusion_groups ?? restored?.cateringInclusionGroups ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Stripe Connect readiness — gates the "Publish" button.
  // null = still loading; server is authoritative regardless.
  const [connectVerified, setConnectVerified] = useState<boolean | null>(null);

  // Collapsible sections
  const [showCategories, setShowCategories] = useState(
    (listing?.category_tags?.length ?? restored?.categories?.length ?? 0) > 0
  );
  // Allergens default-open so the pill list is immediately visible.
  // Creators expect to see the allergen options the same way they see
  // category tags — collapsed-by-default hid the pills and felt broken.
  const [showAllergens, setShowAllergens] = useState(true);
  const [showMinOrder, setShowMinOrder] = useState(!!listing?.min_order || !!restored?.minOrder);

  // Load Connect status once on mount.
  // Fast DB read first. If not yet verified, fire a ?fresh=1 call to sync
  // with live Stripe and trigger the DB write-back — so creators who just
  // finished onboarding don't need a manual DB fix or a trip to Earnings.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/creators/connect/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j) => {
        if (cancelled) return;
        const kyc = j?.data?.kyc_status ?? "not_started";
        if (kyc === "verified") {
          setConnectVerified(true);
          return;
        }
        // DB shows pending/not_started — check live Stripe and write back.
        try {
          const res = await fetch("/api/v1/creators/connect/status?fresh=1");
          if (cancelled) return;
          const fresh = res.ok ? await res.json() : null;
          setConnectVerified((fresh?.data?.kyc_status ?? "not_started") === "verified");
        } catch {
          if (!cancelled) setConnectVerified(false);
        }
      })
      .catch(() => {
        if (!cancelled) setConnectVerified(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save with debounce (new plates only)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const doAutoSave = useCallback(() => {
    if (isEditing) return;
    const hasContent = name.trim() || description.trim() || price || photos.length > 0;
    if (!hasContent) return;

    // Draft stores the combined hours value so old drafts (pre days+hours
    // split) still restore correctly via the decompose on read.
    const combinedLeadHours =
      (parseInt(cateringLeadDays, 10) || 0) * 24 +
      (parseInt(cateringLeadHoursPart, 10) || 0);
    saveDraft({
      kind,
      name, description, price, quantity, minOrder,
      photos, video, fulfillment, categories, allergens,
      cateringPricingMode,
      cateringMinGuests,
      cateringMaxGuests,
      cateringLeadTimeHours: String(combinedLeadHours),
      cateringFulfillment,
      cateringInclusions,
      cateringInclusionGroups,
      savedAt: new Date().toISOString(),
    });
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  }, [
    kind, name, description, price, quantity, minOrder,
    photos, video, fulfillment, categories, allergens,
    cateringPricingMode, cateringMinGuests, cateringMaxGuests,
    cateringLeadDays, cateringLeadHoursPart,
    cateringFulfillment, cateringInclusions, cateringInclusionGroups,
    isEditing,
  ]);
  // The second useEffect (autosave timer) needs the same deps as
  // doAutoSave to re-fire on any change. Update it below.

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
  }, [
    kind, name, description, price, quantity, minOrder,
    photos, video, fulfillment, categories, allergens,
    cateringPricingMode, cateringMinGuests, cateringMaxGuests,
    cateringLeadDays, cateringLeadHoursPart,
    cateringFulfillment, cateringInclusions, cateringInclusionGroups,
    isEditing, doAutoSave,
  ]);

  const priceNum = parseFloat(price) || 0;
  const minGuestsNum = parseInt(cateringMinGuests, 10) || 0;
  const maxGuestsNum = cateringMaxGuests ? parseInt(cateringMaxGuests, 10) : null;
  // Combine days + hours back into the single int the DB column holds.
  const leadTimeNum =
    (parseInt(cateringLeadDays, 10) || 0) * 24 +
    (parseInt(cateringLeadHoursPart, 10) || 0);

  // Publish validation differs by kind. Plates need price + quantity;
  // catering needs price + min guests + lead time + at least one
  // fulfillment option. Photos are required for both.
  const baseCanPublish =
    name.trim().length > 0 &&
    priceNum > 0 &&
    photos.length >= 1 &&
    (kind === "plate"
      ? quantity >= 1
      : minGuestsNum > 0 &&
        leadTimeNum > 0 &&
        cateringFulfillment.length > 0 &&
        (maxGuestsNum === null || maxGuestsNum >= minGuestsNum));

  // Publishing requires Stripe Connect verified so money can flow.
  // Drafts don't require Connect; creator can build out their menu first.
  // Optimistic UX: while we're still loading status (null), let the button
  // be enabled — the server route enforces verification independently and
  // returns a clean error if not. Only mark disabled once we've confirmed
  // the creator is NOT verified. Saves the 200-500ms "phantom-disabled"
  // window we used to have before the Connect status fetch resolved.
  const canPublish = baseCanPublish && connectVerified !== false;
  const canDraft = name.trim().length > 0;

  const buildListingData = (status: ListingStatus) => ({
    kind,
    name: name.trim(),
    description: description.trim(),
    price: priceNum,
    // Catering listings don't have a quantity in the on-demand sense —
    // each booking is its own event. Send 1 so the NOT NULL check holds.
    quantity: kind === "plate" ? quantity : 1,
    min_order: minOrder ? parseFloat(minOrder) || null : null,
    photos,
    video,
    fulfillment_type: fulfillment,
    status,
    category_tags: categories,
    allergens,
    availability_windows: listing?.availability_windows ?? [],
    discount_codes: listing?.discount_codes ?? [],
    // Catering fields — server should ignore/null these when kind='plate'.
    catering_pricing_mode: kind === "catering" ? cateringPricingMode : null,
    catering_min_guests: kind === "catering" ? minGuestsNum : null,
    catering_max_guests: kind === "catering" ? maxGuestsNum : null,
    catering_lead_time_hours: kind === "catering" ? leadTimeNum : null,
    catering_fulfillment: kind === "catering" ? cateringFulfillment : [],
    catering_inclusions:
      kind === "catering" ? cateringInclusions.trim() || null : null,
    catering_inclusion_groups: kind === "catering" ? cateringInclusionGroups : {},
  });

  const handleSave = async (status: ListingStatus) => {
    setSaving(true);

    try {
      const payload = buildListingData(status);
      const url = isEditing && listing
        ? `/api/v1/listings/${listing.id}`
        : "/api/v1/listings";
      const method = isEditing && listing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body?.error || "Failed to save plate. Try again.");
        return;
      }

      if (isEditing) {
        toast.success(
          status === LISTING_STATUS.ACTIVE ? "Plate published!" : "Draft saved."
        );
      } else {
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
    <div className="flex min-h-[100dvh] flex-col bg-[#0A0A0A] pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* Header — translucent sticky chrome via raw backdrop-filter
          (the plugin's `glass-nav` forces `position: fixed; top: 0`
          which would detach the header from this scroll container).
          Back button is 44px (h-11 w-11) per Apple HIG tap target. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90 transition-transform"
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
          {/* Listing kind toggle — first thing the creator picks because
              it changes what fields they'll see. Segmented control over
              a glass-card substrate, 44px tap targets. */}
          <section aria-labelledby="kind-label">
            <div className="mb-2 flex items-center">
              <span
                id="kind-label"
                className="text-sm font-medium text-white/60"
              >
                Listing type
              </span>
              <InfoTip label="What's the difference?">
                {COACHMARK_COPY["creator-catering-kind-toggle"]}
              </InfoTip>
            </div>
            <div
              ref={cateringKindCoachRef}
              role="radiogroup"
              aria-labelledby="kind-label"
              className="glass-segment flex gap-1 p-1"
            >
              {(
                [
                  { value: "plate", label: "Plate", hint: "On-demand orders" },
                  { value: "catering", label: "Catering", hint: "Quoted events" },
                ] as const
              ).map((opt) => {
                const active = kind === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKind(opt.value)}
                    className={cn(
                      "glass-segment-item flex-1 flex flex-col items-center justify-center py-2.5 transition-all active:scale-[0.98]",
                      active
                        ? "bg-green-900/50 text-green-300 border border-green-400/30 shadow-[0_0_12px_rgba(27,94,32,0.30)]"
                        : "text-white/60 hover:text-white/80"
                    )}
                  >
                    <span className="text-sm font-semibold leading-none">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 text-[10px] leading-none text-white/40">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {kind === "catering" && (
              <p className="mt-2 text-xs text-white/50">
                Customers send you an inquiry, you reply with a quote, they
                pay a 30% deposit to lock in the date. Balance auto-charges
                a few days before the event.
              </p>
            )}
          </section>

          {/* Media */}
          <section>
            <label className="mb-2 block text-sm font-medium text-white/60">
              Photos &amp; Video
            </label>
            <div ref={photosCoachRef}>
              <MediaUpload
                photos={photos}
                video={video}
                onPhotosChange={setPhotos}
                onVideoChange={setVideo}
              />
            </div>
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
              ref={nameCoachRef}
              id="plate-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              placeholder="e.g., Smoked Brisket Plate"
              className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {name.length}/{NAME_MAX}
            </p>
          </section>

          {/* Description */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor="plate-desc"
                className="block text-sm font-medium text-white/60"
              >
                Description
              </label>
              {/* AI draft trigger — auto-fires once when the first photo
                  lands (and description is still empty), then acts as a
                  manual Regenerate button. */}
              <AiDraftButton
                kind="plate"
                currentText={description}
                imageUrls={photos}
                context={{
                  plateName: name || undefined,
                  plateTags: categories,
                }}
                autoTriggerKey={
                  photos.length > 0 && !description.trim()
                    ? photos[0]
                    : null
                }
                onTextUpdate={(text) =>
                  setDescription(text.slice(0, DESC_MAX))
                }
              />
            </div>
            <textarea
              id="plate-desc"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, DESC_MAX))
              }
              placeholder="What makes this plate special?"
              rows={3}
              className="glass-input w-full px-4 py-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors resize-none"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {description.length}/{DESC_MAX}
            </p>
          </section>

          {/* Price (plate) OR Per-head/Flat pricing (catering) */}
          {kind === "plate" ? (
            <section>
              <label
                htmlFor="plate-price"
                className="mb-2 block text-sm font-medium text-white/60"
              >
                Price *
              </label>
              <div ref={priceCoachRef} className="relative">
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
                  className="glass-input h-12 w-full pl-10 pr-4 text-lg font-bold text-green-300 placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                />
              </div>
              {/* Inline trigger — opens Mia pre-filled with the
                  plate's name/description so the user doesn't have
                  to retype context. */}
              <div className="mt-2">
                <AskCoachInline
                  seedPrompt={buildPriceCoachSeed({
                    kind: "plate",
                    name,
                    description,
                  })}
                  label="Not sure what to charge?"
                  hint="Ask Mia for a Houston-aware price"
                />
              </div>
            </section>
          ) : (
            <section aria-labelledby="catering-pricing-label">
              <div className="mb-2 flex items-center">
                <span
                  id="catering-pricing-label"
                  className="text-sm font-medium text-white/60"
                >
                  Pricing *
                </span>
                <InfoTip label="Per-head vs flat?">
                  {COACHMARK_COPY["creator-catering-pricing-mode"]}
                </InfoTip>
              </div>
              {/* Per-head vs flat segmented control */}
              <div
                role="radiogroup"
                aria-labelledby="catering-pricing-label"
                className="glass-segment mb-2 flex gap-1 p-1"
              >
                {(
                  [
                    { value: "per_head", label: "Per head" },
                    { value: "flat", label: "Flat package" },
                  ] as const
                ).map((opt) => {
                  const active = cateringPricingMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCateringPricingMode(opt.value)}
                      className={cn(
                        "glass-segment-item flex-1 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
                        active
                          ? "bg-green-900/50 text-green-300 border border-green-400/30 shadow-[0_0_12px_rgba(27,94,32,0.30)]"
                          : "text-white/60 hover:text-white/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {/* Price input — same control either way, label changes */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-green-300">
                  $
                </span>
                <input
                  id="catering-price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, "");
                    if (val.split(".").length <= 2) setPrice(val);
                  }}
                  placeholder="0.00"
                  aria-label={
                    cateringPricingMode === "per_head"
                      ? "Price per guest"
                      : "Flat package price"
                  }
                  className="glass-input h-12 w-full pl-10 pr-24 text-lg font-bold text-green-300 placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-white/40">
                  {cateringPricingMode === "per_head" ? "/ guest" : "flat"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                {cateringPricingMode === "per_head"
                  ? "Customer's quote total = guest count × price. Add fees like delivery or labor on the quote itself."
                  : "Single package price. Add fees like delivery or labor on the quote itself."}
              </p>
              {/* Catering-specific inline Mia trigger. Seed prompt
                  bakes in the per-head/flat mode so she leads with
                  the right math. */}
              <div className="mt-2">
                <AskCoachInline
                  seedPrompt={buildPriceCoachSeed({
                    kind: "catering",
                    name,
                    description,
                    cateringPricingMode,
                  })}
                  label="Pricing a catering package?"
                  hint="Mia factors guest count, food cost + KDER's fee"
                />
              </div>
            </section>
          )}

          {/* Quantity (plate) OR Guest range (catering) */}
          {kind === "plate" ? (
            <section>
              <label className="mb-2 block text-sm font-medium text-white/60">
                Quantity available *
              </label>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </section>
          ) : (
            <section aria-labelledby="catering-guests-label">
              <span
                id="catering-guests-label"
                className="mb-2 block text-sm font-medium text-white/60"
              >
                Guest range *
              </span>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-white/50">
                    Min guests
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={cateringMinGuests}
                    onChange={(e) =>
                      setCateringMinGuests(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="10"
                    className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-white/50">
                    Max guests (optional)
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={cateringMaxGuests}
                    onChange={(e) =>
                      setCateringMaxGuests(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="—"
                    className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                Customers can&apos;t inquire for fewer than the minimum.
                Leave max blank for no upper limit.
              </p>
            </section>
          )}

          {/* Catering-only: Lead time (days + hours) */}
          {kind === "catering" && (
            <section aria-labelledby="catering-lead-label">
              <div className="mb-2 flex items-center">
                <span
                  id="catering-lead-label"
                  className="text-sm font-medium text-white/60"
                >
                  Minimum lead time *
                </span>
                <InfoTip label="What does lead time do?">
                  {COACHMARK_COPY["creator-catering-lead-time"]}
                </InfoTip>
              </div>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-white/50">Days</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={cateringLeadDays}
                    onChange={(e) =>
                      setCateringLeadDays(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="2"
                    className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-white/50">Hours</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    value={cateringLeadHoursPart}
                    onChange={(e) =>
                      setCateringLeadHoursPart(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0"
                    className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                How far in advance customers must book this. The date picker
                on their inquiry form will gray out anything inside this
                window.
              </p>
            </section>
          )}

          {/* Fulfillment (plate single-select) OR Fulfillment (catering multi) */}
          {kind === "plate" ? (
            <section>
              <label className="mb-2 block text-sm font-medium text-white/60">
                Fulfillment
              </label>
              <FulfillmentPicker value={fulfillment} onChange={setFulfillment} />
            </section>
          ) : (
            <section aria-labelledby="catering-fulfillment-label">
              <div className="mb-2 flex items-center">
                <span
                  id="catering-fulfillment-label"
                  className="text-sm font-medium text-white/60"
                >
                  Fulfillment (pick all that apply)
                </span>
                <InfoTip label="Which to pick?">
                  {COACHMARK_COPY["creator-catering-fulfillment"]}
                </InfoTip>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "pickup", label: "Pickup" },
                    { value: "delivery", label: "Delivery" },
                    { value: "onsite", label: "On-site" },
                  ] as const
                ).map((opt) => {
                  const active = cateringFulfillment.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() =>
                        setCateringFulfillment(
                          active
                            ? cateringFulfillment.filter((v) => v !== opt.value)
                            : [...cateringFulfillment, opt.value]
                        )
                      }
                      className={cn(
                        "glass-card flex h-12 items-center justify-center rounded-xl border text-sm font-medium transition-all active:scale-[0.98]",
                        active
                          ? "border-green-400/40 bg-green-900/40 text-green-300 shadow-[0_0_10px_rgba(27,94,32,0.30)]"
                          : "border-white/10 text-white/60 hover:text-white/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Catering-only: What's included.
              Structured editor (Protein / Sides / Desserts / Add-ons /
              Drinks / Toppings/Sauces). Replaces the old free-text
              textarea; the underlying catering_inclusions column is
              still written (empty) for back-compat. */}
          {kind === "catering" && (
            <section>
              <div className="mb-2 flex items-center">
                <label className="text-sm font-medium text-white/60">
                  What&apos;s included
                </label>
                <InfoTip label="How does this work?">
                  {COACHMARK_COPY["creator-catering-inclusions"]}
                </InfoTip>
              </div>
              <CateringInclusionsEditor
                value={cateringInclusionGroups}
                onChange={setCateringInclusionGroups}
              />
              {/* Quietly retain the legacy free-text input as a single-
                  line field below the editor — most creators won't
                  touch it. Kept so older listings still surface their
                  copy in the edit form. */}
              {(cateringInclusions || "").trim().length > 0 && (
                <details className="mt-3 text-xs text-white/40">
                  <summary className="cursor-pointer hover:text-white/60">
                    Legacy free-text inclusions
                  </summary>
                  <textarea
                    value={cateringInclusions}
                    onChange={(e) =>
                      setCateringInclusions(e.target.value.slice(0, 500))
                    }
                    rows={2}
                    className="glass-input mt-2 w-full px-4 py-2 text-sm text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 resize-none"
                  />
                </details>
              )}
            </section>
          )}

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
                className="glass-input h-12 w-full pl-10 pr-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Save / Publish bar with optional Connect hint above. */}
      <FloatingActionBar>
        <div className="space-y-2">
          {/* Connect-not-verified hint: show only once status has loaded
              and we know they can't publish because of Connect
              (not because of the baseline form validation). */}
          {connectVerified === false && baseCanPublish && (
            <p className="text-center text-xs text-orange-300">
              Set up payouts to publish plates.{" "}
              <Link
                href="/earnings"
                className="font-semibold underline underline-offset-2 hover:text-orange-200"
              >
                Go to Earnings →
              </Link>
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleSave(LISTING_STATUS.DRAFT)}
              disabled={!canDraft || saving}
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-full text-sm font-bold transition-transform active:scale-95",
                canDraft && !saving
                  ? "glass-btn-secondary text-white"
                  : "border border-white/10 text-white/30 cursor-not-allowed"
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
      </FloatingActionBar>

      {/* First-time-user coachmarks. Only fire on NEW plate creation
          (not editing) so existing creators editing a plate don't get
          re-nagged. Sequenced: photos → name → price. Each waits for
          the previous to dismiss. The 250ms delay lets the form finish
          mounting before targeting.
          NOTE: the Coachmark component also runs a global FIFO queue
          so simultaneous mounts can't stack visually — but explicit
          chaining keeps the visual order deterministic regardless of
          mount timing. */}
      {!isEditing && !photosCoachDone && (
        <Coachmark
          id="creator-plate-photos"
          copy={COACHMARK_COPY["creator-plate-photos"]}
          targetRef={photosCoachRef}
          showDelayMs={250}
          onDismiss={() => setPhotosCoachDone(true)}
        />
      )}
      {!isEditing && photosCoachDone && !nameCoachDone && (
        <Coachmark
          id="creator-plate-title"
          copy={COACHMARK_COPY["creator-plate-title"]}
          targetRef={nameCoachRef}
          showDelayMs={250}
          onDismiss={() => setNameCoachDone(true)}
        />
      )}
      {!isEditing && photosCoachDone && nameCoachDone && (
        <Coachmark
          id="creator-plate-price"
          copy={COACHMARK_COPY["creator-plate-price"]}
          targetRef={priceCoachRef}
          showDelayMs={250}
        />
      )}
      {/* Catering kind-toggle tip — chained AFTER the new-plate
          sequence (or rendered standalone when editing). Used to
          fire in parallel with the photos coachmark, which stacked
          two "Got it" buttons on the same screen and made dismissal
          feel broken. */}
      {(isEditing || (photosCoachDone && nameCoachDone)) && (
        <Coachmark
          id="creator-catering-kind-toggle"
          copy={COACHMARK_COPY["creator-catering-kind-toggle"]}
          targetRef={cateringKindCoachRef}
          showDelayMs={500}
        />
      )}
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
