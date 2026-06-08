"use client";

import { useAnalyticsContext } from "@/context/AnalyticsContext";

export function useAnalytics() {
  return useAnalyticsContext();
}

