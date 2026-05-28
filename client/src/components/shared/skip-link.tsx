"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SkipLink({
  href = "#main-content",
  children = "Skip to main content",
  className,
}: {
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg",
        className,
      )}
    >
      {children}
    </a>
  );
}
