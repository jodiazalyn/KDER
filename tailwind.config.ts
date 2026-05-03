import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        kder: {
          green: {
            DEFAULT: "#1B5E20",
            light: "#2E7D32",
            glow: "rgba(46, 125, 50, 0.6)",
          },
          dark: "#0A0A0A",
          // Light-theme tokens — used on the public marketing landing
          // page (kder.club/) which is intentionally cream/paper to
          // contrast the dark in-app experience. Inspired by Stooty.
          cream: "#FAF7F2",
          paper: "#FFFFFF",
          ink: "#0E0F0C",
          "ink-muted": "#5B5F58",
          line: "#E7E3DA",
          mint: "#E8F1E5",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Geist (loaded via next/font/google in src/app/layout.tsx) is
        // the new display/body face for the marketing landing. Falls
        // back to the system stack for any surface that doesn't load
        // the variable (e.g. emergency error boundaries).
        sans: [
          "var(--font-geist)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "system-ui",
          "sans-serif",
        ],
      },
      keyframes: {
        "pulse-green": {
          "0%": { boxShadow: "0 0 0 0 rgba(27, 94, 32, 0.6)" },
          "70%": { boxShadow: "0 0 0 20px transparent" },
          "100%": { boxShadow: "0 0 0 0 transparent" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-8px)" },
          "75%": { transform: "translateX(8px)" },
        },
        // Continuous horizontal scroll for the landing TrustStrip
        // marquee. -50% because the content is duplicated 2x inside
        // the wrapper so the loop is seamless.
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-green": "pulse-green 600ms ease-out",
        "shake": "shake 400ms ease-in-out",
        "marquee": "marquee 40s linear infinite",
      },
    },
  },
  plugins: [
    require("liquidglass-tailwind"),
  ],
};

export default config;
