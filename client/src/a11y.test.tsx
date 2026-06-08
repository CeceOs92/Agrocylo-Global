import { render } from "@testing-library/react";
import axe from "axe-core";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SkipLink } from "@/components/shared/skip-link";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { NotificationCenter } from "@/components/NotificationCenter";
import { MobileBottomNav } from "@/app/(root)/_components/mobile-bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: "1",
        type: "order",
        message: "Your order has been confirmed.",
        createdAt: "2026-05-28T08:00:00.000Z",
        isRead: false,
      },
    ],
    unreadCount: 1,
    isLoading: false,
    error: null,
    hasNextPage: false,
    loadNextPage: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toEqual([]);
}

describe("accessibility primitives", () => {
  it("renders a focusable skip link without axe violations", async () => {
    const { container, getByRole } = render(<SkipLink />);
    expect(getByRole("link", { name: /skip to main content/i })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("renders notification preferences without axe violations", async () => {
    const { container } = render(<NotificationPreferences />);
    await expectNoViolations(container);
  });

  it("renders notification center without axe violations", async () => {
    const { container } = render(<NotificationCenter walletAddress="GABC123" />);
    await expectNoViolations(container);
  });

  it("renders the mobile bottom nav without axe violations", async () => {
    const { container } = render(<MobileBottomNav />);
    await expectNoViolations(container);
  });
});
