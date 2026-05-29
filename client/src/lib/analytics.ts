export const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    // Analytics implementation
    console.log(`Event tracked: ${eventName}`, data);
  }
};

export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined') {
    console.log(`Page view: ${url}`);
  }
};
