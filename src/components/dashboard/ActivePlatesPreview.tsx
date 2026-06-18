"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, ImageOff } from "lucide-react";
import type { Listing } from "@/types";

interface ActivePlatesPreviewProps {
  plates: Listing[];
}

export function ActivePlatesPreview({ plates }: ActivePlatesPreviewProps) {
  if (plates.length === 0) {
    return (
      <div className="glass-card rounded-glass-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No active plates yet. Add your first plate and start earning.
        </p>
        <Link
          href="/listings/new"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-5 text-sm font-bold text-white shadow-[0_8px_28px_rgba(34,197,94,0.4)] active:scale-95 transition-transform"
        >
          <Plus size={16} />
          Add Plate
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">
          Active Plates
        </h2>
        <Link
          href="/listings"
          className="text-xs font-medium text-primary hover:text-primary/80"
        >
          View All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {plates.slice(0, 4).map((plate) => (
          <Link
            key={plate.id}
            href={`/listings/${plate.id}/edit`}
            className="glass-card rounded-glass-lg flex-shrink-0 w-36 overflow-hidden active:scale-95 transition-transform"
          >
            <div className="relative h-24 w-full">
              {plate.photos.length > 0 ? (
                <Image
                  src={plate.photos[0]}
                  alt={`Photo of ${plate.name}`}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <ImageOff size={20} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-foreground">
                {plate.name}
              </p>
              <p className="text-sm font-bold text-primary">
                ${plate.price.toFixed(2)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
