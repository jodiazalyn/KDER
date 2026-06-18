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
  const fullUrl = `https://kder.club/@${handle}`;

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
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
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
            ? "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold border border-border bg-muted text-foreground hover:bg-muted/70 active:scale-95 transition-all"
            : "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] hover:opacity-95 active:scale-95 transition-all",
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
