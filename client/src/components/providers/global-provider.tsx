"use client";

import gsap from "gsap";
import { ReactLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import type { LenisRef } from "lenis/react";
import type { FC, ReactNode } from "react";
import NextJsToploader from "nextjs-toploader";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "@/components/QueryProvider";
import WalletProviderWrapper from "@/components/WalletProviderWrapper";
import { TransactionFeedbackProvider } from "@/context/TransactionFeedbackContext";

interface GlobalProviderProps {
  children: ReactNode;
}

/**
 * Single top-level provider stack for the app.
 *
 * Layering (outer → inner):
 *   ThemeProvider               next-themes light/dark mode
 *   ReactLenis                  smooth scroll, RAF driven by GSAP ticker
 *   QueryProvider               TanStack Query cache
 *   TransactionFeedbackProvider transaction-state machine
 *   WalletProviderWrapper       Freighter wallet + Profile + Cart + global Navbar
 *
 * Top-level UI overlays (Toaster, route progress bar) sit alongside `children`
 * so they show on every route.
 */
const GlobalProvider: FC<GlobalProviderProps> = ({ children }) => {
  // Drive Lenis from GSAP's ticker — guarantees Lenis stays in sync with
  // any GSAP-driven animations on a single RAF.
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    function update(time: number) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }
    gsap.ticker.add(update);
    return () => gsap.ticker.remove(update);
  }, []);

  return (
    <ThemeProvider>
      <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
        <QueryProvider>
          <TransactionFeedbackProvider>
            <WalletProviderWrapper>
              <NextJsToploader
                showSpinner={false}
                showForHashAnchor={false}
                showAtBottom={false}
                color="var(--primary)"
              />
              {children}
              <Toaster richColors />
            </WalletProviderWrapper>
          </TransactionFeedbackProvider>
        </QueryProvider>
      </ReactLenis>
    </ThemeProvider>
  );
};

export { GlobalProvider };
