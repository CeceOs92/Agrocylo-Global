import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
  // Issue #755: shared monorepo packages ship raw TS source, so Next.js
  // needs to be told to transpile them like any other app source file.
  transpilePackages: ['@agrocylo/wallet-core'],
};

export default withNextIntl(nextConfig);
