import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("analytics consent gating", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults consentState to "unknown" rather than "granted"', async () => {
    const { getAnalyticsConsent } = await import("./analytics");
    expect(getAnalyticsConsent()).toBe("unknown");
  });

  it('falls back to "unknown" (not "granted") for an unrecognized stored value', async () => {
    window.localStorage.setItem("agrocylo.analytics.consent", "yes-please");
    const { getAnalyticsConsent } = await import("./analytics");
    expect(getAnalyticsConsent()).toBe("unknown");
  });

  it("is a no-op for trackEvent-style calls while consent is unknown", async () => {
    const { trackPageView, trackClick, getAnalyticsEvents } = await import(
      "./analytics"
    );
    trackPageView("/marketplace");
    trackClick({ element: "button", label: "Buy" });
    expect(getAnalyticsEvents()).toHaveLength(0);
  });

  it("is a no-op for trackEvent-style calls once consent is explicitly denied", async () => {
    const { setAnalyticsConsent, trackClick, getAnalyticsEvents } =
      await import("./analytics");
    setAnalyticsConsent("denied");
    trackClick({ element: "button", label: "Buy" });
    const clickEvents = getAnalyticsEvents().filter(
      (event) => event.name === "click",
    );
    expect(clickEvents).toHaveLength(0);
  });

  it("records events once consent is granted", async () => {
    const { setAnalyticsConsent, trackClick, getAnalyticsEvents } =
      await import("./analytics");
    setAnalyticsConsent("granted");
    trackClick({ element: "button", label: "Buy" });
    const clickEvents = getAnalyticsEvents().filter(
      (event) => event.name === "click",
    );
    expect(clickEvents).toHaveLength(1);
  });
});
