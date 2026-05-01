"use client";

import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Whether to render the default top border + blurred dark background.
   * Set `false` when the children have their own card-style chrome.
   * Default `true`.
   */
  styled?: boolean;
}

/**
 * Bottom-fixed action bar that sits ABOVE the BottomNav with proper
 * iPhone safe-area inset (so it clears the home indicator). Used on
 * surfaces inside the (app) shell that need a destructive or
 * commit-style CTA pinned to the bottom — e.g. order Accept/Decline,
 * PlateForm Save, settings Save.
 *
 * Why this primitive exists: every action bar across the app was
 * hard-coded with `bottom-20` (5rem above viewport edge). That
 * ignored `env(safe-area-inset-bottom)` so the bar clipped the home
 * indicator on iPhone X+. Several surfaces also forgot to add enough
 * padding-bottom to their scrollable parent, so the last row of
 * content was hidden behind the bar. Centralizing the math here
 * prevents future drift.
 *
 * Pages using this primitive must also account for the bar's
 * occlusion of scrollable content — either render
 * `<FloatingActionBarSpacer />` at the END of the scroll container, OR
 * set the parent's `pb-[calc(9rem+env(safe-area-inset-bottom))]`
 * directly. Without one of those, the bar covers the last row.
 *
 * For pages WITHOUT a BottomNav (e.g. public storefront `/@handle`
 * which has its own floating Buy Now button), use a different
 * primitive or inline the positioning. This component assumes a
 * BottomNav is rendered above it.
 */
export function FloatingActionBar({
  children,
  className,
  styled = true,
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 py-3",
        styled && "border-t border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}

/**
 * Spacer companion. Render at the END of your scrollable content so
 * the last child isn't hidden behind the FloatingActionBar. Functionally
 * equivalent to setting `pb-[calc(9rem+env(safe-area-inset-bottom))]`
 * on the parent — use whichever fits the surface better.
 *
 * Why offer a spacer at all: declarative locality. Putting a
 * `<FloatingActionBarSpacer />` inside the scroll container is easier
 * to spot during code review than a `pb-[calc(...)]` deep in a
 * className list, and harder to forget when adding a new action bar.
 */
export function FloatingActionBarSpacer() {
  return (
    <div
      aria-hidden="true"
      className="h-[calc(9rem+env(safe-area-inset-bottom))]"
    />
  );
}
