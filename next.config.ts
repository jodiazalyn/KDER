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
  },
};

export default withPWA(nextConfig);
