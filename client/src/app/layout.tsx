import type { Metadata } from "next";
import { montserratAlternates } from "@/fonts";
import { GlobalProvider } from "@/components/providers/global-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroCylo 🌾",
  description:
    "Peer-to-peer agro marketplace secured by Stellar escrow. Farmers sell directly to buyers — no middlemen, no chargebacks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserratAlternates.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
