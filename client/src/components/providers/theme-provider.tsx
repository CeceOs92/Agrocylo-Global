"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Wraps the app with `next-themes` for light/dark mode.
 * `attribute="class"` toggles the `.dark` class on `<html>`, which our
 * Tailwind tokens key off via `@custom-variant dark (&:is(.dark *))` in globals.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
