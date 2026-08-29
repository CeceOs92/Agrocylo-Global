import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom does not implement navigator.sendBeacon, so the transport layer
// falls back to fetch — which lets us assert on outbound requests directly.
describe("analytics network gating (integration)", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("makes no request to the analytics endpoint before consent is granted", async () => {
    const { trackPageView, trackClick } = await import("./analytics");
    trackPageView("/marketplace");
    trackClick({ element: "button", label: "Buy" });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("makes no request to the analytics endpoint while consent is denied", async () => {
    const { setAnalyticsConsent, trackClick } = await import("./analytics");
    setAnalyticsConsent("denied");
    trackClick({ element: "button", label: "Buy" });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only sends a request to the analytics endpoint after consent is granted", async () => {
    const { setAnalyticsConsent, trackClick } = await import("./analytics");
    setAnalyticsConsent("granted");
    trackClick({ element: "button", label: "Buy" });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
