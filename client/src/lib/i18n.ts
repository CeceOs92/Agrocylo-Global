const locales = ['en', 'fr', 'es'] as const;

export type Locale = (typeof locales)[number];

export async function loadMessages(locale?: string) {
  const activeLocale: Locale = locales.includes(locale as Locale) ? (locale as Locale) : 'en';
  const messages = (await import(`../../public/locales/${activeLocale}/common.json`)).default;

  return {
    locale: activeLocale,
    messages,
  };
}

export default loadMessages;
