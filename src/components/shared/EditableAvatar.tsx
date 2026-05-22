"use client";

import { toast } from "sonner";
import { PhotoUpload } from "@/components/onboarding/PhotoUpload";
import { cn } from "@/lib/utils";

interface EditableAvatarProps {
  value: string | null;
  /** Called after photo is uploaded to storage AND saved to DB. */
  onSaved: (url: string) => void;
  size?: number;
  className?: string;
}

/**
 * Drop-in avatar editor that uploads to Supabase Storage then immediately
 * persists the URL to members.photo_url — no save button required.
 * Works from any authenticated page.
 */
export function EditableAvatar({ value, onSaved, size = 120, className }: EditableAvatarProps) {
  const handleChange = async (url: string | null) => {
    if (!url) return;

    const res = await fetch("/api/v1/members/photo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_url: url }),
    });

    if (!res.ok) {
      toast.error("Photo uploaded but failed to save. Try again.");
      return;
    }

    onSaved(url);
    toast.success("Profile photo saved.");
  };

  return (
    <PhotoUpload
      value={value}
      onChange={handleChange}
      size={size}
      className={cn(className)}
    />
  );
}
