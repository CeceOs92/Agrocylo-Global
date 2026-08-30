"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Reports an error that crashed the root layout itself (Issue #756) — the
 * one class of error `src/components/ErrorBoundary.tsx` can't catch, since
 * that boundary lives inside the layout this file replaces entirely.
 * Next.js requires this file to render its own <html>/<body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <p>The error has been reported. Please try again.</p>
        </div>
      </body>
    </html>
  );
}
