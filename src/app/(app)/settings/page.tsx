"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/onboarding/PhotoUpload";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { getCreatorProfileAsync } from "@/lib/creator-store";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import { cn } from "@/lib/utils";

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

  // Email is editable here. If the creator has one, edits must remain
  // a valid format; if it's blank (legacy account before email collection
  // landed), we let them save without one but the dashboard banner will
  // keep nudging until they add it.
  const emailTrimmed = form?.email.trim().toLowerCase() ?? "";
  const isEmailValid = emailTrimmed === "" || EMAIL_RE.test(emailTrimmed);

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
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-6">
        <p className="text-sm text-red-300">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="glass-btn-pill mt-4 px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 size={28} className="animate-spin text-white/40" />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-[#0A0A0A] pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* Header — translucent sticky chrome via raw backdrop-filter
          (the plugin's `glass-nav` forces `position: fixed; top: 0`
          which would detach this from its scroll container).
          Back button bumped to 44px (Apple HIG tap target). */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90 transition-transform"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Profile section */}
        <section className="glass-card p-5 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
            Profile
          </h2>

          <div className="flex justify-center">
            <PhotoUpload
              value={form.photo_url}
              onChange={(url) => setForm({ ...form, photo_url: url })}
            />
          </div>

          {/* Display name */}
          <div>
            <label
              htmlFor="display-name"
              className="mb-2 block text-sm font-medium text-white/60"
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
              className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {form.display_name.length}/{NAME_MAX}
            </p>
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="bio"
              className="mb-2 block text-sm font-medium text-white/60"
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
              className="glass-input w-full px-4 py-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors resize-none"
            />
            <p className="mt-1 text-right text-xs text-white/30">
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
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Email
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
              className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
            />
            <p className="mt-1 text-xs text-white/40">
              {emailTrimmed === ""
                ? "Add an email so you don't miss new-order alerts."
                : isEmailValid
                  ? "Used for order notifications only. Never shared."
                  : "That doesn't look like a valid email."}
            </p>
          </div>
        </section>

        {/* Service area section */}
        <section className="glass-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Service area
            </h2>
            <p className="mt-1 text-xs text-white/40">
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
              className="glass-input h-11 flex-1 rounded-full px-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addZip}
              disabled={currentZip.length !== 5 || addingZip || form.zips.length >= MAX_ZIPS}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
                currentZip.length === 5 && !addingZip && form.zips.length < MAX_ZIPS
                  ? "bg-[#1B5E20] text-white shadow-[0_0_12px_rgba(27,94,32,0.4)]"
                  : "glass-btn-pill text-white/30 cursor-not-allowed"
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
                    <MapPin size={16} className="flex-shrink-0 text-green-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {z.neighborhood}
                      </p>
                      <p className="text-xs text-white/40">{z.zip}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeZip(z.zip)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-400 active:scale-90 transition-all"
                    aria-label={`Remove ${z.neighborhood}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">No zip codes added yet.</p>
          )}
        </section>

        {/* Pickup address section */}
        <section className="glass-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Pickup address
            </h2>
            <p className="mt-1 text-xs text-white/40">
              Shared with customers after they confirm a pickup order.
            </p>
          </div>
          <input
            type="text"
            value={form.pickup_address}
            onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
            placeholder="1234 Main St, Houston, TX 77001"
            className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-colors"
          />
        </section>

        {/* Handle is shown read-only so users know what their URL is */}
        <section className="glass-card p-5 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
            Your KDER link
          </h2>
          <p className="text-base text-white">
            kder.club/@<span className="text-green-300">{form.handle}</span>
          </p>
          <p className="text-xs text-white/40">
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
            "flex h-12 w-full items-center justify-center rounded-full text-sm font-bold text-white transition-all active:scale-95",
            canSave
              ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              : "bg-white/10 text-white/30 cursor-not-allowed"
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
