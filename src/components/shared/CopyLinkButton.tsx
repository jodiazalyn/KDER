"use client";

import { useState, useCallback } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { ShareSheet } from "./ShareSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  handle: string;
  /** "share" = full-width Share Your Link, "compact" = inline Share My Link, "icon" = copy icon only */
  variant?: "share" | "compact" | "icon";
  className?: string;
}

export function CopyLinkButton({
  handle,
  variant = "share",
  className,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fullUrl = `https://kder.com/${handle}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = fullUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setCopied(true);
    toast.success("Link copied! Paste it anywhere to share.");
    setTimeout(() => setCopied(false), 2500);
  }, [fullUrl]);

  // Icon variant — direct copy (no sheet)
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-90",
          copied
            ? "border-green-400/40 bg-green-900/30 text-green-400"
            : "border-white/20 bg-white/[0.08] text-white/70 hover:bg-white/[0.15]",
          className
        )}
        aria-label={copied ? "Link copied" : "Copy storefront link"}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    );
  }

  // Share and compact variants — open share sheet
  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          variant === "compact"
            ? "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold border border-white/25 bg-white/[0.06] text-white hover:bg-white/[0.1] active:scale-95 transition-all"
            : "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold bg-white/[0.15] text-white hover:bg-white/[0.2] active:scale-95 transition-all",
          className
        )}
      >
        <Share2 size={variant === "compact" ? 14 : 16} />
        {variant === "compact" ? "Share My Link" : "Share Your Link"}
      </button>

      <ShareSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        handle={handle}
      />
    </>
  );
}
