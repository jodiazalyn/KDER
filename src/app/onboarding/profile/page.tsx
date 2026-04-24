"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { PhotoUpload } from "@/components/onboarding/PhotoUpload";
import { AiDraftButton } from "@/components/shared/AiDraftButton";
import { cn } from "@/lib/utils";

const NAME_MAX = 40;
const BIO_MAX = 160;

export default function ProfileSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length > 0;

  const handleContinue = async () => {
    if (!isValid || loading) return;
    setLoading(true);

    // Store profile data in sessionStorage for now (saved on final step)
    sessionStorage.setItem(
      "kder_onboarding_profile",
      JSON.stringify({
        display_name: name.trim(),
        bio: bio.trim() || null,
        photo_url: photo,
      })
    );

    router.push("/onboarding/handle");
  };

  const handleSkip = () => {
    if (!name.trim()) return;
    sessionStorage.setItem(
      "kder_onboarding_profile",
      JSON.stringify({
        display_name: name.trim(),
        bio: null,
        photo_url: null,
      })
    );
    router.push("/onboarding/handle");
  };

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-12 bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <ProgressDots current={1} total={3} />
        <button
          onClick={handleSkip}
          disabled={!name.trim()}
          className={cn(
            "text-sm font-medium",
            name.trim()
              ? "text-white/60 hover:text-white"
              : "text-white/20 cursor-not-allowed"
          )}
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full max-w-sm mx-auto">
        <h1 className="text-3xl font-black text-white">Set up your profile</h1>

        {/* Photo upload */}
        <PhotoUpload value={photo} onChange={setPhoto} size={120} />

        {/* Display name */}
        <div className="w-full">
          <label
            htmlFor="display-name"
            className="mb-2 block text-sm font-medium text-white/60"
          >
            Display name *
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value.slice(0, NAME_MAX))
            }
            placeholder="What should people call you?"
            autoFocus
            className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors"
          />
          <p className="mt-1 text-right text-xs text-white/30">
            {name.length}/{NAME_MAX}
          </p>
        </div>

        {/* Bio */}
        <div className="w-full">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-white/60"
            >
              Bio (optional)
            </label>
            {/* Hint-driven AI draft — no photos yet at onboarding, so
                creators type a few keywords ("bbq, brisket, family") and
                Claude fleshes it into a 1–2 sentence bio. */}
            <AiDraftButton
              kind="bio"
              currentText={bio}
              context={{ creatorDisplayName: name || undefined }}
              onTextUpdate={(text) => setBio(text.slice(0, BIO_MAX))}
            />
          </div>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) =>
              setBio(e.target.value.slice(0, BIO_MAX))
            }
            placeholder="Tell people about your food..."
            rows={3}
            className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/35 backdrop-blur-[8px] focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700 transition-colors resize-none"
          />
          <p className="mt-1 text-right text-xs text-white/30">
            {bio.length}/{BIO_MAX}
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="w-full max-w-sm mx-auto pt-4">
        <button
          onClick={handleContinue}
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
            "Continue"
          )}
        </button>
      </div>
    </main>
  );
}
