"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

/**
 * Catches errors thrown by the root layout itself. Unlike error.tsx, this
 * replaces the entire document (html/body), so it must not depend on
 * anything the root layout provides.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      logger?.error?.(error.message, {
        digest: error.digest,
        scope: "global-error",
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    } catch {
      console.error("Uncaught root error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#6b7280" }}>
            An unexpected error occurred. Please try again or contact support
            if the issue persists.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => reset()}
              style={{
                borderRadius: "0.75rem",
                border: "1px solid #d1d5db",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: "0.75rem",
                background: "#16a34a",
                color: "#fff",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
