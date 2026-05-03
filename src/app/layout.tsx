import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Geist via next/font/google. We expose it as a CSS variable so
// Tailwind's `font-sans` (which leads with `var(--font-geist)`) picks
// it up everywhere — but the system stack remains as a fallback for
// any surface that renders before the variable is bound (e.g. an
// emergency error boundary). Subset to the four weights the marketing
// landing actually uses to keep the woff2 payload small.
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kder.club"),
  title: "KDER — Feed the city. Own your income.",
  description:
    "A hospitality sovereignty platform for Houston food creators. List your plates, manage orders, and get paid — all from your phone.",
  manifest: "/manifest.json",
  // Favicon + apple-touch-icon are auto-discovered from
  // src/app/icon.png and src/app/apple-icon.png (Next.js file convention).
  // Likewise opengraph-image.png and twitter-image.png are auto-wired.
  openGraph: {
    title: "KDER — Feed the city. Own your income.",
    description: "Houston's hospitality marketplace for food creators.",
    type: "website",
    siteName: "KDER",
    locale: "en_US",
    url: "https://kder.club",
    // Explicit `images` array (rather than relying on Next.js's
    // file-convention auto-wiring of opengraph-image.png) because
    // some scrapers — Facebook in particular — won't pick up the
    // file-convention path consistently and we want the absolute
    // URL emitted in the page's <meta property="og:image"> for max
    // compatibility. Width/height let scrapers preallocate the
    // preview slot without re-fetching just to measure.
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 1200,
        alt: "KDER — Feed the city. Own your income.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KDER — Feed the city. Own your income.",
    description: "Houston's hospitality marketplace for food creators.",
    images: ["/twitter-image.png"],
  },
  // Image attribution (moved here from visible page credit)
  other: {
    "image-credits":
      "Community hero photo based on Houston 2014 by Katie Haugland Bowen (CC BY 2.0), adapted by KDER.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0A",
  // Required for env(safe-area-inset-*) to take real values on iPhones
  // with notches / Dynamic Island / home indicators. Without this,
  // those env vars resolve to 0 and bottom nav / floating action bars
  // tuck under the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${geist.variable}`}>
      <body className="min-h-screen bg-[#0A0A0A] text-white antialiased">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            className:
              "bg-white/[0.18] backdrop-blur-[40px] border border-white/[0.28] rounded-2xl text-white",
          }}
        />
      </body>
    </html>
  );
}
