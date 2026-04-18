"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, X, Film, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface MediaUploadProps {
  photos: string[];
  video: string | null;
  onPhotosChange: (photos: string[]) => void;
  onVideoChange: (video: string | null) => void;
  maxPhotos?: number;
}

export function MediaUpload({
  photos,
  video,
  onPhotosChange,
  onVideoChange,
  maxPhotos = 5,
}: MediaUploadProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = maxPhotos - photos.length;

    if (files.length > remaining) {
      toast.error(`You can add ${remaining} more photo${remaining === 1 ? "" : "s"}.`);
    }

    const toAdd = files
      .slice(0, remaining)
      .filter((file) => {
        if (!file.type.startsWith("image/")) return false;
        if (file.size > 8 * 1024 * 1024) {
          toast.error("That photo is too large. Use a photo under 8MB.");
          return false;
        }
        return true;
      });

    // Reset input so same file can be re-selected
    e.target.value = "";

    // Upload in parallel, then append all resolved URLs in one setter call.
    setUploadingCount((n) => n + toAdd.length);
    const uploadedUrls: string[] = [];
    await Promise.all(
      toAdd.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/v1/listings/upload", {
            method: "POST",
            body: formData,
          });
          const body = await res.json();
          if (!res.ok || !body?.data?.url) {
            toast.error(body?.error || "Upload failed.");
            return;
          }
          uploadedUrls.push(body.data.url);
        } catch {
          toast.error("Upload failed. Check your connection.");
        } finally {
          setUploadingCount((n) => Math.max(0, n - 1));
        }
      })
    );

    if (uploadedUrls.length > 0) {
      onPhotosChange([...photos, ...uploadedUrls]);
    }
  };

  const handleVideoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100MB.");
      return;
    }

    // Client-side duration check (BR-009)
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.src = URL.createObjectURL(file);
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      if (videoEl.duration > 60) {
        toast.error(
          `Video is ${Math.round(videoEl.duration)}s. Maximum is 60 seconds.`
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onVideoChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    };

    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Photo/Video grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Existing photos */}
        {photos.map((photo, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.12]"
          >
            <Image
              src={photo}
              alt={`Plate photo ${i + 1}`}
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500/80 active:scale-90"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Video thumbnail */}
        {video && (
          <div className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.12]">
            <video
              src={video}
              className="h-full w-full object-cover"
              muted
            />
            <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
              <Film size={10} className="text-white" />
              <span className="text-[10px] text-white">Video</span>
            </div>
            <button
              type="button"
              onClick={() => onVideoChange(null)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500/80 active:scale-90"
              aria-label="Remove video"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Add photo button */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingCount > 0}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.04] text-white/40 hover:border-green-400/40 hover:bg-white/[0.08] hover:text-white/60 active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60"
            aria-label="Add photo"
          >
            {uploadingCount > 0 ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span className="text-[10px]">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus size={24} />
                <span className="text-[10px]">Photo</span>
              </>
            )}
          </button>
        )}

        {/* Add video button */}
        {!video && (
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.04] text-white/40 hover:border-green-400/40 hover:bg-white/[0.08] hover:text-white/60 active:scale-95 transition-all"
            aria-label="Add video"
          >
            <Film size={24} />
            <span className="text-[10px]">Video</span>
          </button>
        )}
      </div>

      <p className="text-xs text-white/30">
        {photos.length}/{maxPhotos} photos{video ? " + 1 video" : ""} · Video max 60s
      </p>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoSelect}
        className="hidden"
      />
    </div>
  );
}
