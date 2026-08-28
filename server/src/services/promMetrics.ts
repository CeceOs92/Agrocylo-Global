import client from "prom-client";

/**
 * Prometheus-format metrics (Issue #756). Exported via `GET /metrics/prom`
 * (see `routes/metricsRoutes.ts`) in the standard text exposition format, so
 * any metrics backend (self-hosted Prometheus, Grafana Agent, Datadog's
 * OpenMetrics scraper, ...) can pull it without a bespoke translator —
 * deliberately not coupled to a specific vendor, since Issue #4 (deployment
 * target) hadn't landed a choice at the time this was written. This is
 * additive to the existing JSON `getPlatformMetrics()` business-metrics
 * endpoint (`GET /metrics`), which stays as-is for its existing dashboard
 * consumers.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds, labeled by method/route/status",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests, labeled by method/route/status",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

export const websocketConnections = new client.Gauge({
  name: "websocket_connections",
  help: "Current number of connected WebSocket clients",
  registers: [registry],
});

export const queueJobLagSeconds = new client.Histogram({
  name: "queue_job_lag_seconds",
  help: "Seconds between a job being enqueued and becoming active (queue backlog indicator)",
  labelNames: ["queue"],
  buckets: [0.5, 1, 5, 15, 30, 60, 300, 900],
  registers: [registry],
});

export const queueJobFailuresTotal = new client.Counter({
  name: "queue_job_failures_total",
  help: "Total failed queue jobs, labeled by queue and job name",
  labelNames: ["queue", "job"],
  registers: [registry],
});

/**
 * Records one completed HTTP request. `route` should be the matched route
 * pattern (e.g. "/orders/:id"), not the raw URL, to keep label cardinality
 * bounded — callers fall back to the raw path only when no route matched
 * (404s, middleware-only paths), which is an accepted, bounded exception.
 */
export function recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
  const labels = { method, route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationMs / 1000);
}
