"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";

interface MediaCarouselProps {
  photos: string[];
  video: string | null;
  title: string;
  priority?: boolean;
}

type Asset = { type: "video"; src: string } | { type: "photo"; src: string };

export function MediaCarousel({
  photos,
  video,
  title,
  priority = false,
}: MediaCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const assets: Asset[] = [
    ...(video ? [{ type: "video" as const, src: video }] : []),
    ...photos.map((src) => ({ type: "photo" as const, src })),
  ];

  const total = assets.length;
  const hasVideo = !!video;

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const newIndex = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(newIndex);
    const vid = videoRef.current;
    if (vid) {
      if (newIndex === 0 && hasVideo) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }
  }, [hasVideo]);

  // Pause/resume video when carousel enters/leaves the viewport.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && activeIndex === 0) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(vid);
    return () => observer.disconnect();
  }, [activeIndex]);

  const scrollTo = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  if (total === 0) return null;

  return (
    <div
      className="relative overflow-hidden bg-black"
      style={{ aspectRatio: hasVideo ? "9/16" : "16/10" }}
    >
      {/* Scroll container — CSS scroll-snap, no JS library */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {assets.map((asset, i) => (
          <div
            key={i}
            className="relative flex-shrink-0 w-full h-full"
            style={{ scrollSnapAlign: "start" }}
          >
            {asset.type === "video" ? (
              <>
                <video
                  ref={videoRef}
                  src={asset.src}
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  // 44×44 tap target — was 36×36 with a 15px icon, easy
                  // to miss with a thumb on a vertically scrolling feed.
                  className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm active:scale-90 transition-transform"
                  aria-label={muted ? "Unmute video" : "Mute video"}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                {/* Video badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-white">▶ VIDEO</span>
                </div>
              </>
            ) : (
              <Image
                src={asset.src}
                alt={`${title} photo ${i + 1}`}
                fill
                priority={priority && i === 0}
                sizes="(max-width: 640px) 100vw, 640px"
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators — only shown when there's more than one asset */}
      {total > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {assets.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              className={`pointer-events-auto h-1.5 rounded-full transition-all duration-200 ${
                i === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
