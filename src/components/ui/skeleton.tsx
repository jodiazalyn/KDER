import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // Liquid Glass shimmer (defined in globals.css) replaces the
      // original animate-pulse + bg-muted. Reads as a translucent
      // sheen sweeping across the surface — consistent with the
      // glass-shine specular highlight on cards/buttons. Honors
      // prefers-reduced-motion via globals.css.
      className={cn(
        "rounded-glass bg-foreground/[0.04] animate-glass-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
