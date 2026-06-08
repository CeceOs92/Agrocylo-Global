"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { initAnalytics, trackPageView } from "@/lib/analytics";

export default function AnalyticsInit() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    trackPageView(pathname);
  }, [pathname]);

  return null;
}
