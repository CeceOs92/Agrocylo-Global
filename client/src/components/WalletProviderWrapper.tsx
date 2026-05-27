"use client";

import React from "react";
import { WalletProvider } from "../context/WalletContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import NotificationPoller from "./NotificationPoller";

/**
 * Mounts the wallet/profile/cart contexts plus globally-mounted UI overlays
 * (cart drawer, notification poller).
 *
 * The Navbar lives in `(root)/layout.tsx` rather than here, so that route
 * groups with their own shells (dashboard, admin) can render a sidebar
 * instead of the public-site nav.
 */
export default function WalletProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <ProfileProvider>
        <CartProvider>
          {children}
          <CartDrawer />
          <NotificationPoller />
        </CartProvider>
      </ProfileProvider>
    </WalletProvider>
  );
}
