"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, MapPin, Trash2 } from "lucide-react";
import { KderSpinner } from "@/components/ui/kder-spinner";
import { toast } from "sonner";
import { EditableAvatar } from "@/components/shared/EditableAvatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { getCreatorProfileAsync } from "@/lib/creator-store";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import { cn } from "@/lib/utils";
import { DiscountCodesEditor } from "@/components/settings/DiscountCodesEditor";
import type { DiscountCode } from "@/types";

const NAME_MAX = 40;
const BIO_MAX = 160;
const EMAIL_MAX = 254;
const MAX_ZIPS = 5;

// Loose RFC-5322-ish check, matching the onboarding-profile validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ZipEntry {
  zip: string;
  neighborhood: string;
}

interface ProfileFormState {
  display_name: string;
  bio: string;
  email: string;
  photo_url: string | null;
  handle: string; // kept for round-trip only; not editable here
  zips: ZipEntry[];
  pickup_address: string;
  /** Flat self-delivery fee, held as a dollar string for the input
   *  (e.g. "3.50"). Empty / "0" = free delivery. */
  delivery_fee: string;
  instagram_handle: string;
  tiktok_handle: string;
  website_url: string;
  facebook_handle: string;
  whatsapp_number: string;
  discount_codes: DiscountCode[];
}

function toFormState(p: Awaited<ReturnType<typeof getCreatorProfileAsync>>): ProfileFormState {
  return {
    display_name: p.display_name || "",
    bio: p.bio || "",
    email: p.email || "",
    photo_url: p.photo_url,
    handle: p.handle || "",
    zips: (p.neighborhoods || []).map((n) => ({ zip: n.zip, neighborhood: n.name })),
    pickup_address: p.pickup_address || "",
    delivery_fee: p.delivery_fee_cents > 0 ? (p.delivery_fee_cents / 100).toFixed(2) : "",
    instagram_handle: p.instagram_handle || "",
    tiktok_handle: p.tiktok_handle || "",
    website_url: p.website_url || "",
    facebook_handle: p.facebook_handle || "",
    whatsapp_number: p.whatsapp_number || "",
    discount_codes: p.discount_codes || [],
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [initial, setInitial] = useState<ProfileFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Zip-input-specific state
  const [currentZip, setCurrentZip] = useState("");
  const [addingZip, setAddingZip] = useState(false);

  // Load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getCreatorProfileAsync();
        if (cancelled) return;
        const next = toFormState(profile);
        setForm(next);
        setInitial(next);
      } catch {
        if (!cancelled) setLoadError("Couldn't load your profile. Try refreshing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!form || !initial) return false;
    return JSON.stringify(form) !== JSON.stringify(initial);
  }, [form, initial]);

  // Email is REQUIRED here — it's how the creator gets new-order alerts,
  // so we can't let them save without a valid one. Legacy accounts that
  // predate email collection will be nudged to add one the next time they
  // save any change (enforced going forward).
  const emailTrimmed = form?.email.trim().toLowerCase() ?? "";
  const isEmailValid = EMAIL_RE.test(emailTrimmed);

  const canSave =
    !!form &&
    !!form.display_name.trim() &&
    isEmailValid &&
    isDirty &&
    !saving;

  const addZip = async () => {
    if (!form || currentZip.length !== 5 || addingZip) return;

    if (form.zips.some((z) => z.zip === currentZip)) {
      toast.error("You already added this zip code.");
      return;
    }

    if (form.zips.length >= MAX_ZIPS) {
      toast.error(`Maximum ${MAX_ZIPS} zip codes allowed.`);
      return;
    }

    // Houston instant resolver
    const resolved = resolveZipToNeighborhood(currentZip);
    if (resolved) {
      setForm({
        ...form,
        zips: [...form.zips, { zip: currentZip, neighborhood: resolved.neighborhood }],
      });
      setCurrentZip("");
      return;
    }

    // Fallback: generic US zip lookup
    setAddingZip(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${currentZip}`);
      if (!res.ok) {
        toast.error("We couldn't find that zip code.");
        return;
      }
      const data = await res.json();
      const place = data.places?.[0];
      const label = place
        ? `${place["place name"]}, ${place["state abbreviation"]}`
        : `Zip ${currentZip}`;
      setForm({
        ...form,
        zips: [...form.zips, { zip: currentZip, neighborhood: label }],
      });
      setCurrentZip("");
    } catch {
      toast.error("Couldn't look up that zip. Check your connection.");
    } finally {
      setAddingZip(false);
    }
  };

  const removeZip = (zip: string) => {
    if (!form) return;
    setForm({ ...form, zips: form.zips.filter((z) => z.zip !== zip) });
  };

  const handleSave = async () => {
    if (!form || !canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/creators/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          handle: form.handle, // unchanged — onboard route requires it
          photo_url: form.photo_url,
          bio: form.bio.trim() || null,
          email: emailTrimmed || null,
          zips: form.zips.map((z) => z.zip),
          pickup_address: form.pickup_address.trim() || null,
          // Self-delivery flat fee (migration 025). Dollars → cents. Blank
          // or non-numeric = free ($0). Server clamps + caps regardless.
          delivery_fee_cents: Math.round((parseFloat(form.delivery_fee) || 0) * 100),
          instagram_handle: form.instagram_handle.trim() || null,
          tiktok_handle: form.tiktok_handle.trim() || null,
          website_url: form.website_url.trim() || null,
          facebook_handle: form.facebook_handle.trim() || null,
          whatsapp_number: form.whatsapp_number.trim() || null,
          // Promo codes (migration 024). Drop rows with a blank code so a
          // half-filled row the creator never named isn't persisted; the
          // server re-sanitizes (uppercase, dedupe, clamps) regardless.
          discount_codes: form.discount_codes.filter((c) => c.code.trim()),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't save changes. Try again.");
        return;
      }
      toast.success("Profile updated.");
      setInitial(form); // reset dirty tracking
      router.refresh(); // surface changes to dashboard / header
    } catch {
      toast.error("Couldn't save changes. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <p className="text-sm text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="glass-btn-pill mt-4 px-4 py-2 text-sm text-foreground"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <KderSpinner size={64} />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-background pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* Header — translucent sticky chrome via raw backdrop-filter
          (the plugin's `glass-nav` forces `position: fixed; top: 0`
          which would detach this from its scroll container). Token
          bg/border make it frosted-white in light, dark glass in dark —
          the same Apple-glass construction as the BottomNav. Back button
          is a 44px tap target (Apple HIG). */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        {/* In-app light/dark switch lives here now that settings follows
            the global theme (the route is no longer dark-pinned). */}
        <ThemeToggle className="ml-auto h-11 w-11 flex-shrink-0 text-foreground" />
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Profile section */}
        <section className="glass-card p-5 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profile
          </h2>

          <div className="flex justify-center">
            <EditableAvatar
              value={form.photo_url}
              onSaved={(url) => setForm({ ...form, photo_url: url })}
            />
          </div>

          {/* Display name */}
          <div>
            <label
              htmlFor="display-name"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              value={form.display_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  display_name: e.target.value.slice(0, NAME_MAX),
                })
              }
              placeholder="What should people call you?"
              className="glass-input h-12 w-full px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground/60">
              {form.display_name.length}/{NAME_MAX}
            </p>
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="bio"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Bio
            </label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={(e) =>
                setForm({ ...form, bio: e.target.value.slice(0, BIO_MAX) })
              }
              placeholder="Tell customers about your food"
              rows={3}
              className="glass-input w-full px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors resize-none"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground/60">
              {form.bio.length}/{BIO_MAX}
            </p>
          </div>

          {/* Email — required for order alerts. We surface validation
              inline so a blank settings save (e.g., dirty bio + empty
              email field on a legacy account) doesn't get rejected
              with a generic toast. */}
          <div>
            <label
              htmlFor="settings-email"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Email <span className="text-primary">*</span>
            </label>
            <input
              id="settings-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value.slice(0, EMAIL_MAX) })
              }
              placeholder="you@example.com"
              className="glass-input h-12 w-full px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {emailTrimmed === ""
                ? "Add an email so you don't miss new-order alerts."
                : isEmailValid
                  ? "Used for order notifications only. Never shared."
                  : "That doesn't look like a valid email."}
            </p>
          </div>
        </section>

        {/* Social links section */}
        <section className="glass-card p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Social &amp; Web
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown on your public storefront so customers can follow you.
            </p>
          </div>

          {/* Instagram */}
          <div>
            <label htmlFor="instagram" className="mb-2 block text-sm font-medium text-muted-foreground">
              Instagram
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-muted-foreground/60 text-base select-none">@</span>
              <input
                id="instagram"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={form.instagram_handle}
                onChange={(e) =>
                  setForm({ ...form, instagram_handle: e.target.value.replace(/^@/, "").slice(0, 30) })
                }
                placeholder="yourhandle"
                className="glass-input h-12 w-full pl-8 pr-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
              />
            </div>
          </div>

          {/* TikTok */}
          <div>
            <label htmlFor="tiktok" className="mb-2 block text-sm font-medium text-muted-foreground">
              TikTok
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-muted-foreground/60 text-base select-none">@</span>
              <input
                id="tiktok"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={form.tiktok_handle}
                onChange={(e) =>
                  setForm({ ...form, tiktok_handle: e.target.value.replace(/^@/, "").slice(0, 24) })
                }
                placeholder="yourhandle"
                className="glass-input h-12 w-full pl-8 pr-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="mb-2 block text-sm font-medium text-muted-foreground">
              Website
            </label>
            <input
              id="website"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value.slice(0, 500) })}
              placeholder="https://yoursite.com"
              className="glass-input h-12 w-full px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            />
            {form.website_url && !/^https?:\/\/.+/.test(form.website_url.trim()) && (
              <p className="mt-1 text-xs text-amber-600 dark:text-orange-400">Must start with https://</p>
            )}
          </div>

          {/* Facebook */}
          <div>
            <label htmlFor="facebook" className="mb-2 block text-sm font-medium text-muted-foreground">
              Facebook
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-muted-foreground/60 text-base select-none">@</span>
              <input
                id="facebook"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={form.facebook_handle}
                onChange={(e) =>
                  setForm({ ...form, facebook_handle: e.target.value.replace(/^@/, "").slice(0, 50) })
                }
                placeholder="yourpage"
                className="glass-input h-12 w-full pl-8 pr-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label htmlFor="whatsapp" className="mb-2 block text-sm font-medium text-muted-foreground">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.whatsapp_number}
              onChange={(e) =>
                setForm({ ...form, whatsapp_number: e.target.value.replace(/[^\d+\-\s()]/g, "").slice(0, 20) })
              }
              placeholder="+1 713 555 0100"
              className="glass-input h-12 w-full px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            />
            <p className="mt-1 text-xs text-muted-foreground">Include country code, e.g. +1 for US</p>
          </div>
        </section>

        {/* Service area section */}
        <section className="glass-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Service area
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to {MAX_ZIPS} zip codes where you deliver or serve.
            </p>
          </div>

          {/* Add-zip input */}
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={currentZip}
              onChange={(e) =>
                setCurrentZip(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addZip();
                }
              }}
              placeholder="Enter zip code"
              disabled={form.zips.length >= MAX_ZIPS}
              className="glass-input h-11 flex-1 rounded-full px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addZip}
              disabled={currentZip.length !== 5 || addingZip || form.zips.length >= MAX_ZIPS}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
                currentZip.length === 5 && !addingZip && form.zips.length < MAX_ZIPS
                  ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
                  : "glass-btn-pill text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-label="Add zip code"
            >
              {addingZip ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
            </button>
          </div>

          {/* Zip list */}
          {form.zips.length > 0 ? (
            <div className="space-y-2">
              {form.zips.map((z) => (
                <div
                  key={z.zip}
                  className="glass-card flex items-center justify-between px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin size={16} className="flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {z.neighborhood}
                      </p>
                      <p className="text-xs text-muted-foreground">{z.zip}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeZip(z.zip)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 active:scale-90 transition-all"
                    aria-label={`Remove ${z.neighborhood}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No zip codes added yet.</p>
          )}
        </section>

        {/* Delivery fee section (migration 025) — flat self-delivery fee.
            The creator drives the order themselves; this fee is added to
            the customer's total and paid out to the creator. Blank = free
            delivery. Gated to the service-area ZIPs above. */}
        <section className="glass-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Delivery fee
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Flat fee you charge to deliver an order yourself, in your
              service area. Leave blank for free delivery. Customers see this
              when they pick delivery at checkout.
            </p>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-muted-foreground/60 text-base select-none">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={form.delivery_fee}
              onChange={(e) =>
                setForm({
                  ...form,
                  // Allow digits + a single decimal point, max 2 decimals.
                  delivery_fee: e.target.value
                    .replace(/[^\d.]/g, "")
                    .replace(/(\..*)\./g, "$1")
                    .replace(/^(\d*\.\d{2}).*$/, "$1"),
                })
              }
              placeholder="0.00"
              className="glass-input h-12 w-full pl-8 pr-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {form.delivery_fee && parseFloat(form.delivery_fee) > 0
              ? `Customers pay $${(parseFloat(form.delivery_fee) || 0).toFixed(2)} for delivery.`
              : "Delivery is free for customers."}
          </p>
        </section>

        {/* Pickup address section */}
        <section className="glass-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pickup address
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared with customers after they confirm a pickup order.
            </p>
          </div>
          <input
            type="text"
            value={form.pickup_address}
            onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
            placeholder="1234 Main St, Houston, TX 77001"
            className="glass-input h-12 w-full px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
          />
        </section>

        {/* Promo codes (migration 024) — storefront-wide discount codes
            customers enter at checkout. */}
        <DiscountCodesEditor
          codes={form.discount_codes}
          onChange={(next) => setForm({ ...form, discount_codes: next })}
        />

        {/* Handle is shown read-only so users know what their URL is */}
        <section className="glass-card p-5 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your KDER link
          </h2>
          <p className="text-base text-foreground">
            kder.club/@<span className="text-primary">{form.handle}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Handle changes aren&apos;t supported yet — contact support if you need to change it.
          </p>
        </section>
      </div>

      {/* Save bar — disabled when nothing's dirty. */}
      <FloatingActionBar>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "flex h-12 w-full items-center justify-center rounded-full text-sm font-bold transition-all active:scale-95",
            canSave
              ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)]"
              : "bg-muted text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isDirty ? (
            "Save changes"
          ) : (
            "No changes"
          )}
        </button>
      </FloatingActionBar>
    </main>
  );
}
