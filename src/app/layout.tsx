import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDER — Feed the city. Own your income.",
  description:
    "A hospitality sovereignty platform for Houston food creators. List your plates, manage orders, and get paid — all from your phone.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/app-icon-512.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "KDER — Feed the city. Own your income.",
    description: "Houston's hospitality marketplace for food creators.",
    type: "website",
    images: [{ url: "/icons/app-icon-512.png", width: 128, height: 128 }],
  },
  twitter: {
    card: "summary",
    title: "KDER — Feed the city. Own your income.",
    description: "Houston's hospitality marketplace for food creators.",
    images: ["/icons/app-icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0A",
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
