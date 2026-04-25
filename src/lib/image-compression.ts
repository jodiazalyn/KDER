"use client";

import imageCompression, {
  type Options as ImageCompressionOptions,
} from "browser-image-compression";

/**
 * Client-side image compression for KDER uploads.
 *
 * Camera-shot photos from modern phones are 2–5MB. Uploading them as-is
 * blows past the Next/Image proxy's processing budget on mobile cellular
 * (we saw repeated 8.5s timeouts on the live site) and burns creator
 * bandwidth on every plate post.
 *
 * Strategy:
 *   - Resize so the longest side is at most MAX_DIMENSION (2048px). At our
 *     largest display surface (PlateDetailSheet hero, ~640px wide × 2x DPR
 *     = 1280px), 2048px provides room to crop/zoom without quality loss.
 *   - Re-encode JPEG at q=0.85 — visually indistinguishable from the
 *     original on plate photography while typically 6–10× smaller.
 *   - Offload to a Web Worker so the UI doesn't freeze while encoding a
 *     5MB file on a mid-range Android.
 *   - Auto-rotate using EXIF — iPhone landscape photos render sideways
 *     without this step.
 *
 * Skips compression entirely for files <500KB (already small enough that
 * re-encoding would only burn CPU for negligible gain) and for non-image
 * mime types (the upload form shouldn't pass these in, but defensive).
 *
 * Library: `browser-image-compression` (~30KB gzipped). Falls back to
 * main-thread canvas when OffscreenCanvas isn't available, so older
 * Safari versions still benefit.
 */

// 2048px longest side. Quality 0.85. Tunable via env if we ever need to
// trade size for fidelity.
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;
// Below this size, re-encoding is wasted work — return the original file.
const SKIP_THRESHOLD_BYTES = 500 * 1024;

export interface CompressionResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  /** True when the file was returned as-is (already small / not an image). */
  skipped: boolean;
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const originalBytes = file.size;

  // Skip non-image types and already-small files.
  if (!file.type.startsWith("image/") || originalBytes <= SKIP_THRESHOLD_BYTES) {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      skipped: true,
    };
  }

  const options: ImageCompressionOptions = {
    maxWidthOrHeight: MAX_DIMENSION,
    initialQuality: JPEG_QUALITY,
    useWebWorker: true,
    // Force JPEG output for the typical photo case — preserves PNG only
    // when the source file was PNG (which is rare for plate photos).
    fileType: file.type === "image/png" ? "image/png" : "image/jpeg",
    // The library will accept slightly larger output than the source if
    // re-encoding produces a bigger file (e.g. when the source was already
    // aggressively compressed). Cap so we never INCREASE the byte count.
    maxSizeMB: Math.max(0.5, originalBytes / (1024 * 1024)),
  };

  try {
    const compressed = await imageCompression(file, options);
    // If the library returned something larger than the original (rare but
    // possible for already-tight JPEGs), keep the original instead.
    if (compressed.size >= originalBytes) {
      return {
        file,
        originalBytes,
        compressedBytes: originalBytes,
        skipped: true,
      };
    }
    return {
      file: compressed,
      originalBytes,
      compressedBytes: compressed.size,
      skipped: false,
    };
  } catch (err) {
    // If compression fails for any reason (corrupt EXIF, unsupported
    // codec, OOM on a really big image), fall back to the original. The
    // upload still succeeds — just at the original byte cost.
    console.warn("[image-compression] failed, using original", err);
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      skipped: true,
    };
  }
}

/** For logging / dev-time visibility. */
export function formatCompressionLog(result: CompressionResult): string {
  const kb = (b: number) => Math.round(b / 1024);
  if (result.skipped) {
    return `[image-compression] kept original ${kb(result.originalBytes)}KB`;
  }
  const ratio = (result.compressedBytes / result.originalBytes) * 100;
  return `[image-compression] ${kb(result.originalBytes)}KB → ${kb(
    result.compressedBytes
  )}KB (${Math.round(ratio)}%)`;
}
