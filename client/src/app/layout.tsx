import type { Metadata, Viewport } from "next";

import { montserratAlternates } from "@/fonts";
import { siteConfig } from "@/config/site.config";
import { GlobalProvider } from "@/components/providers/global-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
  description: siteConfig.description,
  icons: siteConfig.icons,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: siteConfig.ogTitle,
    description: siteConfig.ogDescription,
    url: siteConfig.url,
    siteName: siteConfig.title,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.ogTitle,
      },
    ],
  },
  twitter: {
    card: siteConfig.tCard,
    title: siteConfig.tTitle,
    description: siteConfig.tDescription,
    images: [siteConfig.ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${montserratAlternates.variable} flex min-h-dvh flex-col bg-background font-sans antialiased`}
      >
        <ErrorBoundary>
          <GlobalProvider>{children}</GlobalProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
