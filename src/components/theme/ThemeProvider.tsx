"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * App-wide theme provider.
 *
 * The KDER app is mid-migration from a single dark "Liquid Glass" theme to a
 * light-default look with a light/dark toggle. We default to `light` (the new
 * face of the app) and keep dark available via the toggle. `attribute="class"`
 * toggles the `.dark` class on <html>, which our token sets in globals.css key
 * off of. `enableSystem` is intentionally false — light is the deliberate
 * default, not the OS preference.
 *
 * Surfaces that haven't been restyled yet are pinned to dark locally with
 * `className="dark"` on their wrapper (see the (app) shell + /super), which
 * still works because those pins set the same `.dark` class.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
