import type { Metadata } from "next";
import { Toaster } from "sonner";
import { montserratAlternates } from "@/fonts";
import { ThemeProvider } from "@/components/providers/theme-provider";
import WalletProviderWrapper from "../components/WalletProviderWrapper";
import QueryProvider from "../components/QueryProvider";
import { TransactionFeedbackProvider } from "@/context/TransactionFeedbackContext";
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
        <ThemeProvider>
          <QueryProvider>
            <TransactionFeedbackProvider>
              <WalletProviderWrapper>{children}</WalletProviderWrapper>
            </TransactionFeedbackProvider>
          </QueryProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
