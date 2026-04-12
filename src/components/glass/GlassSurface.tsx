"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

const tiers = {
  sm: "bg-white/[0.06] backdrop-blur-[8px] border border-white/[0.12] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.3)]",
  default:
    "bg-white/[0.10] backdrop-blur-[16px] border border-white/[0.18] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]",
  lg: "bg-white/[0.14] backdrop-blur-[24px] border border-white/[0.22] rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.20),0_12px_40px_rgba(0,0,0,0.45)]",
  xl: "bg-white/[0.18] backdrop-blur-[40px] border border-white/[0.28] rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.25),0_16px_48px_rgba(0,0,0,0.5)]",
  green:
    "bg-green-900/[0.40] backdrop-blur-[20px] border border-green-400/[0.25] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.20),0_8px_32px_rgba(0,0,0,0.40)]",
} as const;

export type GlassTier = keyof typeof tiers;

interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tier?: GlassTier;
  as?: "div" | "section" | "article" | "nav" | "aside" | "header" | "footer";
}

const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ tier = "default", as: Component = "div", className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(tiers[tier], className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassSurface.displayName = "GlassSurface";

export { GlassSurface, tiers as glassTiers };
