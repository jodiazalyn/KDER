import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "KDER — Feed the city. Own your income.",
    description: "Houston's hospitality marketplace for food creators.",
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
    <html lang="en" className="dark">
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
