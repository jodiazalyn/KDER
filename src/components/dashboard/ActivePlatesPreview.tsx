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
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 text-center">
        <p className="text-sm text-white/50">
          No active plates yet. Add your first plate and start earning.
        </p>
        <Link
          href="/listings/new"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#1B5E20] px-5 text-sm font-bold text-white shadow-[0_0_16px_rgba(27,94,32,0.4)] active:scale-95 transition-transform"
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
        <h2
          className="text-lg font-bold text-green-300"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
        >
          Active Plates
        </h2>
        <Link
          href="/listings"
          className="text-xs font-medium text-green-400 hover:text-green-300"
        >
          View All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {plates.slice(0, 4).map((plate) => (
          <Link
            key={plate.id}
            href={`/listings/${plate.id}/edit`}
            className="flex-shrink-0 w-36 overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)] active:scale-95 transition-transform"
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
                <div className="flex h-full items-center justify-center bg-white/[0.04]">
                  <ImageOff size={20} className="text-white/20" />
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-white">
                {plate.name}
              </p>
              <p className="text-sm font-bold text-green-300">
                ${plate.price.toFixed(2)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
