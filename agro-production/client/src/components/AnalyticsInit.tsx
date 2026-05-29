"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";
import { initErrorTracking } from "@/lib/errorTracking";

export default function AnalyticsInit() {
  useEffect(() => {
    initAnalytics();
    initErrorTracking();
  }, []);

  return null;
}
