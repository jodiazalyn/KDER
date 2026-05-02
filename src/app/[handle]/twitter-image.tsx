/**
 * Twitter card image — same dimensions and visual treatment as the
 * Open Graph image, so we just re-export the same generator.
 *
 * Twitter's `summary_large_image` card uses 1200x630, identical to the
 * OG spec, and there's no benefit to a separately tuned card. If we
 * ever want Twitter-specific copy, fork this file at that point.
 *
 * Note: `runtime` and `revalidate` are declared inline (not re-exported)
 * because Next's static segment-config analyzer can't follow re-exports
 * for those particular fields and falls back to defaults with a warning.
 */

export { default } from "./opengraph-image";
export { alt, size, contentType } from "./opengraph-image";

export const runtime = "edge";
export const revalidate = 60;
