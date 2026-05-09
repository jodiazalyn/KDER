"use client";

import { useRef } from "react";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { Coachmark } from "@/components/ui/coachmark";
import { COACHMARK_COPY } from "@/lib/coachmarks";

interface ShareLinkCardProps {
  handle: string;
}

export function ShareLinkCard({ handle }: ShareLinkCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const link = `kder.club/@${handle}`;

  return (
    <div
      ref={cardRef}
      // glass-card-elevated for the dashboard's most-actionable card
      // + glass-shine for the specular highlight. KDER green tint
      // layered on top via Tailwind utilities (per design-system.md
      // pattern for accent-tinted glass surfaces).
      className="glass-card-elevated glass-shine rounded-glass-lg border-emerald-400/30 bg-emerald-500/15 p-4"
    >
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

      {/* First-visit tip on the dashboard's most-actionable surface.
          A 600ms delay lets the dashboard's other content settle so
          the spotlight measures the right rect. */}
      <Coachmark
        id="creator-share-link"
        copy={COACHMARK_COPY["creator-share-link"]}
        targetRef={cardRef}
        showDelayMs={600}
      />
    </div>
  );
}
