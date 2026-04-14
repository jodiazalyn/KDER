"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, MapPin, Trash2 } from "lucide-react";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { resolveZipToNeighborhood } from "@/data/houston-zips";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ZipEntry {
  zip: string;
  neighborhood: string;
  tier: string;
}

const MAX_ZIPS = 5;

export default function TermsPage() {
  const router = useRouter();
  const [zips, setZips] = useState<ZipEntry[]>([]);
  const [currentZip, setCurrentZip] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = zips.length > 0 && termsAccepted;

  const [addingZip, setAddingZip] = useState(false);

  const addZip = async () => {
    if (currentZip.length !== 5 || addingZip) return;

    if (zips.some((z) => z.zip === currentZip)) {
      toast.error("You already added this zip code.");
      return;
    }

    if (zips.length >= MAX_ZIPS) {
      toast.error(`Maximum ${MAX_ZIPS} zip codes allowed.`);
      return;
    }

    // Check Houston dataset first
    const resolved = resolveZipToNeighborhood(currentZip);
    if (resolved) {
      setZips([
        ...zips,
        {
          zip: currentZip,
          neighborhood: resolved.neighborhood,
          tier: resolved.tier,
        },
      ]);
      setCurrentZip("");
      return;
    }

    // Look up any US zip via Zippopotam API
    setAddingZip(true);
    try {
      const res = await fetch(
        `https://api.zippopotam.us/us/${currentZip}`
      );
      if (!res.ok) {
        toast.error(
          "We couldn't find that zip code. Check the number and try again."
        );
        return;
      }
      const data = await res.json();
      const place = data.places?.[0];
      const cityState = place
        ? `${place["place name"]}, ${place["state abbreviation"]}`
        : `Zip ${currentZip}`;

      setZips([
        ...zips,
        { zip: currentZip, neighborhood: cityState, tier: "other" },
      ]);
      setCurrentZip("");
    } catch {
      toast.error(
        "Couldn't look up that zip. Check your connection and try again."
      );
    } finally {
      setAddingZip(false);
    }
  };

  const removeZip = (zip: string) => {
    setZips(zips.filter((z) => z.zip !== zip));
  };

  const handleFinish = async () => {
    if (!isValid || loading) return;
    setLoading(true);

    // Store all onboarding data
    sessionStorage.setItem(
      "kder_onboarding_zips",
      JSON.stringify(zips.map((z) => z.zip))
    );
    sessionStorage.setItem(
      "kder_onboarding_terms_accepted",
      new Date().toISOString()
    );

    // Save all onboarding data to Supabase
    let profile: Record<string, string> = {};
    let handle = "mystore";
    try {
      const profileRaw = sessionStorage.getItem("kder_onboarding_profile");
      profile = profileRaw ? JSON.parse(profileRaw) : {};
      handle = sessionStorage.getItem("kder_onboarding_handle") || "mystore";
    } catch {
      // sessionStorage read/parse failed — use defaults
    }

    try {
      await fetch("/api/v1/creators/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: profile.display_name || "Creator",
          handle: handle || "mystore",
          photo_url: profile.photo_url || null,
          bio: profile.bio || null,
          zips: zips.map((z) => z.zip),
        }),
      });
    } catch {
      // Non-blocking — sessionStorage fallback still works
      console.error("Failed to save onboarding to Supabase");
    }

    toast.success("Welcome to KDER! Let's create your first plate.");
    router.push("/dashboard");
  };

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-12 bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <ProgressDots current={3} total={3} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-8 w-full max-w-sm mx-auto mt-8">
        <h1 className="text-3xl font-black text-white">
          Almost there
        </h1>

        {/* Zip code section */}
        <div>
          <h2 className="mb-3 text-lg font-bold text-white">
            Where do you serve?
          </h2>

          {/* Zip input row */}
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={currentZip}
              onChange={(e) =>
                setCurrentZip(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") addZip();
              }}
              placeholder="Enter zip code"
              className="h-12 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
              aria-label="Zip code"
            />
            <button
              onClick={addZip}
              disabled={currentZip.length !== 5 || addingZip}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl transition-all active:scale-95",
                currentZip.length === 5 && !addingZip
                  ? "bg-[#1B5E20] text-white"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
              aria-label="Add zip code"
            >
              {addingZip ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Plus size={20} />
              )}
            </button>
          </div>

          {/* Added zips */}
          {zips.length > 0 && (
            <div className="mt-4 space-y-2">
              {zips.map((z) => (
                <div
                  key={z.zip}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 backdrop-blur-[8px]"
                >
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {z.neighborhood}
                      </p>
                      <p className="text-xs text-white/40">{z.zip}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeZip(z.zip)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 hover:text-red-400 active:scale-95"
                    aria-label={`Remove ${z.neighborhood}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add more zips toggle */}
          {zips.length >= 1 && zips.length < MAX_ZIPS && !showAddMore && (
            <button
              onClick={() => setShowAddMore(true)}
              className="mt-3 text-sm text-green-400 hover:text-green-300"
            >
              + Add more service areas (up to {MAX_ZIPS - zips.length} more)
            </button>
          )}

          {zips.length === 0 && (
            <p className="mt-2 text-xs text-white/30">
              Enter your zip code to set your service area
            </p>
          )}
        </div>

        {/* Terms section */}
        <div className="mt-4">
          <label
            htmlFor="terms-checkbox"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-[8px] transition-colors hover:bg-white/[0.1]"
          >
            <input
              id="terms-checkbox"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-white/30 bg-transparent accent-green-500"
            />
            <span className="text-sm text-white/80">
              I agree to KDER&apos;s{" "}
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline font-medium text-green-400 underline hover:text-green-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="rounded-t-3xl border-white/[0.22] bg-[#0A0A0A]/95 backdrop-blur-[24px] text-white max-h-[70vh] overflow-y-auto"
                >
                  <SheetHeader>
                    <SheetTitle className="text-white">
                      Terms of Service
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4 text-sm text-white/70 pb-8">
                    <p>
                      KDER operates as a Member-to-Member (M2M) hospitality
                      marketplace. Every transaction on the platform is
                      structured as a service agreement between a Creator
                      (Service Provider) and an ordering Member (Client).
                    </p>
                    <p>
                      By using KDER, you acknowledge that all food items are
                      prepared by independent creators in accordance with Texas
                      cottage food law. KDER does not prepare, inspect, or
                      guarantee any food items.
                    </p>
                    <p>
                      KDER charges a 5% platform fee on each completed
                      transaction, deducted from the creator&apos;s payout.
                      Listing on KDER is always free.
                    </p>
                    <p>
                      Full Terms of Service will be available before public
                      launch. By checking the box, you agree to these
                      preliminary terms.
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            </span>
          </label>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="w-full max-w-sm mx-auto pt-4">
        <button
          onClick={handleFinish}
          disabled={!isValid || loading}
          className={cn(
            "flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-white transition-all duration-200",
            "active:scale-95",
            isValid && !loading
              ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
              : "bg-white/10 cursor-not-allowed opacity-50"
          )}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            "Finish"
          )}
        </button>
      </div>
    </main>
  );
}
