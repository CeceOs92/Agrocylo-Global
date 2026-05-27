import { trackError } from "./analytics";

const ERROR_REPORTING_ENABLED =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_ERROR_REPORTING_ENABLED !== "false";

let originalOnError: typeof window.onerror | null = null;
let originalOnUnhandledRejection: typeof window.onunhandledrejection | null = null;

function reportError(error: Error, context?: Record<string, unknown>) {
  if (!ERROR_REPORTING_ENABLED) return;

  const payload = {
    message: error.message,
    stack: error.stack,
    context,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  trackError(error.name, error.message);

  try {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
  }
}

export function initErrorTracking() {
  if (typeof window === "undefined" || !ERROR_REPORTING_ENABLED) return;

  originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const err = error ?? new Error(String(message));
    reportError(err, { source, lineno, colno });
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    const err =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    reportError(err, { type: "unhandled_rejection" });
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection.call(window, event);
    }
  };

  console.error = ((original) => {
    return (...args: unknown[]) => {
      const error = args.find((a) => a instanceof Error) as Error | undefined;
      if (error) {
        reportError(error, { console: true });
      } else {
        const msg = args.map((a) => String(a)).join(" ");
        trackError("console.error", msg.slice(0, 200));
      }
      original.apply(console, args);
    };
  })(console.error);
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  reportError(error, context);
}
