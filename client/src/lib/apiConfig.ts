/**
 * Single source of truth for backend connection configuration.
 *
 * Set NEXT_PUBLIC_API_URL in `.env.local` for both REST and Socket.io.
 * Default points at the Express dev server.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
