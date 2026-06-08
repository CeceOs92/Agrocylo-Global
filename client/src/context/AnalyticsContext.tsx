"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AnalyticsConsentState,
  AnalyticsEvent,
  AnalyticsFunnelName,
  AnalyticsMetrics,
  AnalyticsSnapshot,
  AnalyticsProperties,
} from "@/lib/analytics";
import {
  exportAnalyticsData,
  getAnalyticsSnapshot,
  setAnalyticsConsent,
  subscribeAnalytics,
  trackClick,
  trackError,
  trackFeatureAdoption,
  trackFilterUsage,
  trackFunnelStep,
  trackFormSubmission,
  trackHover,
  trackPageView,
  trackSearchQuery,
  trackThemeToggled,
  trackTransactionAttempt,
  trackWalletConnected,
  trackWalletDisconnected,
} from "@/lib/analytics";

export interface AnalyticsContextValue {
  consent: AnalyticsConsentState;
  enabled: boolean;
  events: AnalyticsEvent[];
  metrics: AnalyticsMetrics;
  snapshot: AnalyticsSnapshot;
  refresh: () => void;
  setConsent: (consent: AnalyticsConsentState) => void;
  exportJson: () => string;
  exportCsv: () => string;
  trackPageView: typeof trackPageView;
  trackClick: typeof trackClick;
  trackHover: typeof trackHover;
  trackFormSubmission: typeof trackFormSubmission;
  trackTransactionAttempt: typeof trackTransactionAttempt;
  trackSearchQuery: typeof trackSearchQuery;
  trackFilterUsage: typeof trackFilterUsage;
  trackFeatureAdoption: typeof trackFeatureAdoption;
  trackFunnelStep: (
    funnel: AnalyticsFunnelName,
    step: string,
    properties?: AnalyticsProperties,
  ) => void;
  trackWalletConnected: typeof trackWalletConnected;
  trackWalletDisconnected: typeof trackWalletDisconnected;
  trackThemeToggled: typeof trackThemeToggled;
  trackError: typeof trackError;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(() =>
    getAnalyticsSnapshot(),
  );

  const refresh = useCallback(() => {
    setSnapshot(getAnalyticsSnapshot());
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAnalytics(refresh);
    return () => {
      unsubscribe();
    };
  }, [refresh]);

  const setConsent = useCallback((consent: AnalyticsConsentState) => {
    setAnalyticsConsent(consent);
    refresh();
  }, [refresh]);

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      consent: snapshot.consent,
      enabled: snapshot.enabled,
      events: snapshot.events,
      metrics: snapshot.metrics,
      snapshot,
      refresh,
      setConsent,
      exportJson: () => exportAnalyticsData("json"),
      exportCsv: () => exportAnalyticsData("csv"),
      trackPageView,
      trackClick,
      trackHover,
      trackFormSubmission,
      trackTransactionAttempt,
      trackSearchQuery,
      trackFilterUsage,
      trackFeatureAdoption,
      trackFunnelStep,
      trackWalletConnected,
      trackWalletDisconnected,
      trackThemeToggled,
      trackError,
    }),
    [refresh, setConsent, snapshot],
  );

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalyticsContext must be used within AnalyticsProvider");
  }
  return context;
}
