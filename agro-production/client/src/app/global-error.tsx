"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Reports an error that crashed the root layout itself (Issue #756).
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
