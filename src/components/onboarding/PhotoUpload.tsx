"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setLoading(false);
    };
    reader.onerror = () => {
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/20 bg-white/[0.06] transition-colors hover:border-green-400/40 hover:bg-white/[0.1]",
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
      ) : (
        <Camera
          size={size * 0.3}
          className={cn("text-white/40", loading && "animate-pulse")}
        />
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
