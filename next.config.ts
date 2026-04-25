import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tree-shake heavy libraries that we use across many surfaces. Saves
  // ~10–15% on every route's first-load JS.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // Supabase Storage public URLs
        // e.g. https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Unsplash (used for seeded demo photos)
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // Prefer AVIF (~30% smaller than WebP), then WebP, then JPEG/PNG.
    formats: ["image/avif", "image/webp"],
    // Keep optimized variants at the edge for 24h. Plate photos are
    // immutable once uploaded (creators upload a new one rather than
    // overwrite), so a long TTL is safe.
    minimumCacheTTL: 86400,
    // Tuned for KDER's actual breakpoints — 213px matches our 3-col
    // storefront tile width (640px viewport ÷ 3). Default is wider and
    // wastes optimizer work on sizes we never display.
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1280, 1920],
    imageSizes: [16, 32, 64, 96, 128, 213, 256, 384],
  },
};

export default withPWA(nextConfig);
