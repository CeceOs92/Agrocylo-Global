declare module 'next-intl/plugin' {
  import type { NextConfig } from 'next';

  export default function createNextIntlPlugin(
    requestConfigPath?: string,
  ): (config: NextConfig) => NextConfig;
}

declare module 'next-intl/middleware' {
  import type { NextMiddleware } from 'next/server';

  type MiddlewareConfig = {
    locales: readonly string[];
    defaultLocale?: string;
    localePrefix?: 'always' | 'as-needed' | 'never';
  };

  export default function createMiddleware(
    config: MiddlewareConfig,
  ): NextMiddleware;
}

declare module 'next-intl/server' {
  type RequestConfig<T = unknown> = (params: { locale?: string }) => T | Promise<T>;

  export function getRequestConfig<T>(
    config: RequestConfig<T>,
  ): (params: { locale?: string }) => T | Promise<T>;
}

declare module 'next/dist/compiled/web-vitals' {
  export interface Metric {
    name: string;
    value: number;
    delta: number;
    id: string;
    entries: PerformanceEntry[];
    label?: string;
  }

  export function onCLS(callback: (metric: Metric) => void): void;
  export function onINP(callback: (metric: Metric) => void): void;
  export function onLCP(callback: (metric: Metric) => void): void;
  export function onTTFB(callback: (metric: Metric) => void): void;
  export function onFCP(callback: (metric: Metric) => void): void;
}
