"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import enMessages from "../locales/en/common.json";
import esMessages from "../locales/es/common.json";
import frMessages from "../locales/fr/common.json";

export type Locale = "en" | "es" | "fr";

export const SUPPORTED_LOCALES: Locale[] = ["en", "es", "fr"];
const LOCALE_STORAGE_KEY = "ap_locale";

const messagesMap: Record<Locale, Record<string, any>> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
};

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as string[]).includes(value);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always render "en" on the server and on first client paint so hydration
  // matches; the persisted preference (if any) is applied right after mount.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      /* storage unavailable (private mode, quota) — stay on default */
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — selection still applies for this session */
    }
  };

  const t = (keyPath: string, fallback?: string): string => {
    const keys = keyPath.split(".");
    let current: any = messagesMap[locale] || enMessages;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        return fallback || keyPath;
      }
    }
    return typeof current === "string" ? current : fallback || keyPath;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
