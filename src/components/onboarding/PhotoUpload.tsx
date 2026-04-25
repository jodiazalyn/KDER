"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  compressImage,
  formatCompressionLog,
} from "@/lib/image-compression";

interface PhotoUploadProps {
  /** Current photo URL (stored in Supabase Storage). */
  value: string | null;
  /** Called with the uploaded public URL on success, or null on clear. */
  onChange: (url: string | null) => void;
  size?: number;
  className?: string;
}

export function PhotoUpload({
  value,
  onChange,
  size = 120,
  className,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    // Route enforces 5MB; give the user a pre-flight message for larger files.
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That photo is too large. Max 5MB.");
      return;
    }

    setLoading(true);
    try {
      const compression = await compressImage(file);
      if (process.env.NODE_ENV !== "production") {
        console.log(formatCompressionLog(compression));
      }
      const formData = new FormData();
      formData.append("file", compression.file);
      const res = await fetch("/api/v1/profile/upload", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || !body?.data?.url) {
        toast.error(body?.error || "Upload failed. Try again.");
        return;
      }
      onChange(body.data.url);
    } catch {
      toast.error("Upload failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={loading}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/20 bg-white/[0.06] transition-colors hover:border-green-400/40 hover:bg-white/[0.1] disabled:cursor-wait",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={value ? "Change profile photo" : "Upload profile photo"}
    >
      {value ? (
        <Image
          src={value}
          alt="Profile photo preview"
          fill
          className="object-cover"
        />
      ) : loading ? (
        <Loader2 size={size * 0.3} className="animate-spin text-white/60" />
      ) : (
        <Camera size={size * 0.3} className="text-white/40" />
      )}

      {loading && value && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 size={size * 0.25} className="animate-spin text-white" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden
      />
    </button>
  );
}
