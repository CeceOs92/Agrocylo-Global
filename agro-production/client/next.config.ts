import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
};

export default withNextIntl(nextConfig);
