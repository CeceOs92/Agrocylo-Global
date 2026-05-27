type EventName =
  | "page_view"
  | "wallet_connected"
  | "wallet_disconnected"
  | "order_placed"
  | "order_created"
  | "investment_made"
  | "product_viewed"
  | "campaign_viewed"
  | "theme_toggled"
  | "error_occurred";

type EventProperties = Record<string, string | number | boolean | undefined>;

const ANALYTICS_ENABLED =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false";

const eventQueue: Array<{ name: EventName; properties?: EventProperties }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function sendToAnalyticsEndpoint(events: typeof eventQueue) {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon("/api/analytics", body);
  } else {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0);
  sendToAnalyticsEndpoint(batch);
}

function enqueue(name: EventName, properties?: EventProperties) {
  if (!ANALYTICS_ENABLED) return;
  eventQueue.push({ name, properties });
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 2000);
  }
}

export function trackPageView(path: string) {
  enqueue("page_view", { path });
}

export function trackWalletConnected(address?: string) {
  enqueue("wallet_connected", address ? { address: address.slice(0, 8) } : undefined);
}

export function trackWalletDisconnected() {
  enqueue("wallet_disconnected");
}

export function trackOrderPlaced(campaignId: string, amount: string) {
  enqueue("order_placed", { campaignId, amount });
}

export function trackInvestmentMade(productId: string, amount: number) {
  enqueue("investment_made", { productId, amount: String(amount) });
}

export function trackProductViewed(productId: string) {
  enqueue("product_viewed", { productId });
}

export function trackCampaignViewed(campaignId: string) {
  enqueue("campaign_viewed", { campaignId });
}

export function trackThemeToggled(theme: "dark" | "light") {
  enqueue("theme_toggled", { theme });
}

export function trackError(errorType: string, message: string) {
  enqueue("error_occurred", { errorType, message });
}

export function initAnalytics() {
  if (typeof window === "undefined" || !ANALYTICS_ENABLED) return;

  window.addEventListener("beforeunload", () => flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  trackPageView(window.location.pathname);

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    trackPageView(window.location.pathname);
  };
  window.addEventListener("popstate", () => {
    trackPageView(window.location.pathname);
  });
}
