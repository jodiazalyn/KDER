"use client";

import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

interface ShareLinkCardProps {
  handle: string;
}

export function ShareLinkCard({ handle }: ShareLinkCardProps) {
  const link = `kder.com/${handle}`;

  return (
    <div className="rounded-2xl border border-green-400/[0.25] bg-green-900/[0.40] p-4 backdrop-blur-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]">
      <p className="text-xs font-medium text-green-300/70 uppercase tracking-wider">
        Your storefront link
      </p>

      <div className="mt-2 flex items-center gap-2">
        <p className="flex-1 text-lg font-bold text-white truncate">
          {link}
        </p>
        <CopyLinkButton handle={handle} variant="icon" />
      </div>

      <div className="mt-3">
        <CopyLinkButton handle={handle} variant="share" />
      </div>
    </div>
  );
}
