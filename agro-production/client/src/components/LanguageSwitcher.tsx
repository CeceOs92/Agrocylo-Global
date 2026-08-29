"use client";

import { useI18n, SUPPORTED_LOCALES, type Locale } from "@/context/I18nContext";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  fr: "FR",
};

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={t("navigation.language", "Language")}
      className="text-muted hover:text-foreground border border-border px-2 py-1.5 rounded-lg text-sm bg-transparent transition-colors"
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
