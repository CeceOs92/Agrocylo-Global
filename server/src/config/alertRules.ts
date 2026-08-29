/**
 * Alert rules configuration for the Agrocylo platform.
 *
 * These rules define thresholds for operational alerts that should trigger
 * when production health metrics deviate from normal ranges.
 *
 * Alert routing (Slack, PagerDuty, email) must be configured outside this file
 * in the monitoring system's own configuration (Prometheus AlertManager, etc.)
 *
 * Severity levels:
 * - critical: immediate intervention required (pages on-call)
 * - warning: investigation recommended within business hours
 * - info: informational only, no action required
 */

export interface AlertRule {
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  condition: string;
  threshold: number;
  duration: string; // Prometheus duration format: 5m, 1h, etc.
  runbook?: string; // Link to incident response playbook
}

export const alertRules: AlertRule[] = [
  {
    name: 'HighErrorRate',
    description: 'Error rate exceeds 5% of total requests',
    severity: 'critical',
    condition: '(error_count / request_count) * 100 > 5',
    threshold: 5,
    duration: '5m',
    runbook: 'https://runbooks.example.com/error-rate',
  },
  {
    name: 'HighErrorRateWarning',
    description: 'Error rate exceeds 1% of total requests',
    severity: 'warning',
    condition: '(error_count / request_count) * 100 > 1',
    threshold: 1,
    duration: '10m',
  },
  {
    name: 'RateLimitExhaustion',
    description: 'High number of rate limit rejections indicating abuse or traffic spike',
    severity: 'warning',
    condition: 'rate_limit_rejections > 100 per 5m',
    threshold: 100,
    duration: '5m',
  },
  {
    name: 'IdempotencyConflicts',
    description: 'Unusual number of concurrent idempotency conflicts detected',
    severity: 'warning',
    condition: 'idempotency_conflicts > 10 per 5m',
    threshold: 10,
    duration: '5m',
  },
  {
    name: 'RedisUnavailable',
    description: 'Redis connection lost, rate limiting and idempotency degraded',
    severity: 'critical',
    condition: 'redis_connection_errors > 0 for 1m',
    threshold: 0,
    duration: '1m',
    runbook: 'https://runbooks.example.com/redis-unavailable',
  },
  {
    name: 'DatabaseConnectionPoolExhaustion',
    description: 'Database connection pool nearing capacity',
    severity: 'critical',
    condition: 'db_active_connections > 8 of 10',
    threshold: 8,
    duration: '2m',
  },
  {
    name: 'SlowDatabaseQueries',
    description: 'High number of slow queries (> 500ms) detected',
    severity: 'warning',
    condition: 'slow_query_count > 10 per 5m',
    threshold: 10,
    duration: '5m',
  },
  {
    name: 'SentryErrorCaptureFailed',
    description: 'Sentry is unavailable, error tracking not transmitting',
    severity: 'warning',
    condition: 'sentry_transmission_errors > 5 per 5m',
    threshold: 5,
    duration: '5m',
  },
  {
    name: 'IndexerLag',
    description: 'Blockchain indexer is lagging behind chain tip',
    severity: 'warning',
    condition: 'max(event_cursor) < chain_tip - 100 blocks',
    threshold: 100,
    duration: '10m',
    runbook: 'https://runbooks.example.com/indexer-lag',
  },
  {
    name: 'WebSocketDisconnectStorm',
    description: 'Abnormal spike in WebSocket disconnections',
    severity: 'warning',
    condition: 'ws_disconnect_count > 100 per 5m',
    threshold: 100,
    duration: '5m',
  },
];

/**
 * Example Prometheus alerting rules in YAML format.
 * This should be saved to alerts.yaml and loaded into Prometheus.
 *
 * groups:
 * - name: agrocylo-alerts
 *   interval: 30s
 *   rules:
 *   - alert: HighErrorRate
 *     expr: (increase(error_count_total[5m]) / increase(request_count_total[5m])) * 100 > 5
 *     for: 5m
 *     annotations:
 *       summary: "High error rate detected (> 5%)"
 *       description: "Error rate has exceeded 5% for the last 5 minutes"
 *       runbook: "https://runbooks.example.com/error-rate"
 *
 *   - alert: RedisUnavailable
 *     expr: rate(redis_connection_errors_total[1m]) > 0
 *     for: 1m
 *     annotations:
 *       summary: "Redis connection failed"
 *       description: "Rate limiting and idempotency cache are degraded"
 *       runbook: "https://runbooks.example.com/redis-unavailable"
 *
 *   - alert: IndexerLag
 *     expr: (max(event_cursor) - chain_tip) < -100
 *     for: 10m
 *     annotations:
 *       summary: "Blockchain indexer is lagging"
 *       description: "Indexer is more than 100 blocks behind the chain tip"
 *       runbook: "https://runbooks.example.com/indexer-lag"
 */

/**
 * Grafana dashboard JSON schema for alert visualization.
 * Configure these metrics in your Grafana dashboard:
 * - request_count and error_count (top-level metrics)
 * - idempotency_hits, idempotency_misses, idempotency_conflicts
 * - redis_connection_errors
 * - db_active_connections (from Prometheus postgres_sd_exporter)
 * - slow_query_count (from database query logs)
 * - sentry_transmission_errors (custom instrumentation)
 * - event_cursor, chain_tip (from indexer metrics)
 * - ws_disconnect_count (from WebSocket handler metrics)
 */
