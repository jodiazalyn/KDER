"use client";

import Image from "next/image";
import { Images } from "lucide-react";

interface SpecialtiesGalleryProps {
  /** Photos pulled from the creator's plates (deduped, first-per-plate). */
  photos: string[];
  /** Optional tap handler — e.g. jump to the menu. */
  onSeeAll?: () => void;
}

/**
 * Airbnb-Experiences-style "My specialties" collage: one large photo on the
 * left, two stacked on the right, with a "+N photos" overlay on the last tile
 * when the creator has more than three. Purely presentational — the images are
 * a photographic taste of the kitchen, not individually shoppable here (the
 * bookable items live in the Menu section above).
 *
 * Renders nothing when there are fewer than 3 photos, since the collage layout
 * relies on the 1-big-2-small shape to look intentional.
 */
export function SpecialtiesGallery({ photos, onSeeAll }: SpecialtiesGalleryProps) {
  if (photos.length < 3) return null;

  const [hero, second, third] = photos;
  const remaining = photos.length - 3;

  return (
    <section className="px-4 py-6">
      <div className="mb-3 flex items-center gap-2">
        <Images size={18} className="text-primary" />
        <h2 className="text-lg font-bold tracking-[-0.01em] text-foreground">
          My specialties
        </h2>
      </div>

      <div className="grid h-[240px] grid-cols-2 gap-1.5 overflow-hidden rounded-2xl">
        {/* Large hero tile (left, full height) */}
        <GalleryTile src={hero} alt="Specialty dish" priority sizes="320px" />

        {/* Two stacked tiles (right) */}
        <div className="grid grid-rows-2 gap-1.5">
          <GalleryTile src={second} alt="Specialty dish" sizes="320px" />
          <button
            type="button"
            onClick={onSeeAll}
            className="group relative h-full w-full overflow-hidden bg-muted"
            aria-label="See all specialties"
          >
            <Image
              src={third}
              alt="Specialty dish"
              fill
              sizes="320px"
              className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
            {remaining > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white backdrop-blur-[1px]">
                +{remaining} photos
              </span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function GalleryTile({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
