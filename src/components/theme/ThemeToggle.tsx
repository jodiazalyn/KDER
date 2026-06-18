"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark switch. Renders a glass pill button that flips the active theme.
 *
 * next-themes resolves the theme on the client only — `resolvedTheme` is
 * `undefined` on the server and on the first client render, then fills in
 * after hydration. We key the icon off that: while it's undefined we render
 * a same-size invisible placeholder so the markup matches across SSR/hydration
 * (no mismatch) and layout doesn't shift.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = resolvedTheme != null;
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`glass-btn-pill inline-flex items-center justify-center !px-0 !py-0 ${
        className || "h-9 w-9"
      }`}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <Moon className="h-4 w-4 opacity-0" />
      )}
    </button>
  );
}
