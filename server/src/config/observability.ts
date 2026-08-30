import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { trace, context, propagation } from '@opentelemetry/api';
import logger from './logger.js';
import { config } from './index.js';

// Regex patterns for PII scrubbing
const WALLET_ADDRESS_PATTERN = /[G][A-Z0-9]{55}/g;
const PRIVATE_KEY_PATTERN = /S[A-Z0-9]{55}/g;

/**
 * Sensitive field patterns that should be scrubbed before transmission.
 * Matches wallet addresses (Stellar format) and private keys.
 */
export const SENSITIVE_PATTERNS = [
  WALLET_ADDRESS_PATTERN,
  PRIVATE_KEY_PATTERN,
];

/**
 * Scrub sensitive fields (wallet addresses, keys) from error payloads.
 * This is applied in beforeSend hook to prevent transmission of PII.
 */
function scrubSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    let scrubbed = data;
    scrubbed = scrubbed.replace(WALLET_ADDRESS_PATTERN, '[WALLET_ADDRESS_REDACTED]');
    scrubbed = scrubbed.replace(PRIVATE_KEY_PATTERN, '[PRIVATE_KEY_REDACTED]');
    return scrubbed;
  }

  if (typeof data === 'object' && data !== null) {
    const result = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (
        key.toLowerCase().includes('wallet') ||
        key.toLowerCase().includes('address') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token')
      ) {
        (result as Record<string, unknown>)[key] = '[REDACTED]';
      } else {
        (result as Record<string, unknown>)[key] = scrubSensitiveData(value);
      }
    }
    return result;
  }

  return data;
}

/**
 * Initialize Sentry for exception capture across the application.
 * Configured with:
 * - Wallet address scrubbing in beforeSend hook
 * - Release tagging for version tracking
 * - Environment-specific tracing rates
 *
 * Degradation policy: FAIL OPEN
 * If Sentry is unavailable, the application continues normally.
 * Exceptions are still logged locally but not transmitted.
 */
export function initializeSentry(processType: 'api' | 'worker' | 'watcher'): void {
  if (!process.env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured, error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: config.nodeEnv,
      release: process.env.npm_package_version || 'unknown',
      integrations: [
        nodeProfilingIntegration(),
        new Sentry.Integrations.Http({ tracing: true }),
      ],
      // Scrub sensitive data before transmission
      beforeSend: (event) => {
        if (event.request) {
          event.request = scrubSensitiveData(event.request) as Sentry.SentryRequest;
        }
        if (event.extra) {
          event.extra = scrubSensitiveData(event.extra) as Record<string, unknown>;
        }
        if (event.tags) {
          event.tags = scrubSensitiveData(event.tags) as Record<string, string>;
        }
        return event;
      },
      // Sampling rates: higher in production
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      // Attach stack traces to all messages
      attachStacktrace: true,
    });

    // Add custom tags for process type
    Sentry.setTag('process_type', processType);
    Sentry.setTag('node_env', config.nodeEnv);

    logger.info(`Sentry initialized for ${processType} process`, {
      environment: config.nodeEnv,
      release: process.env.npm_package_version,
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
    // Fail open: application continues without error tracking
  }
}

/**
 * Create a span for tracing with request correlation.
 * Propagates the x-request-id through span attributes.
 */
export function createSpan(
  name: string,
  attributes: Record<string, unknown> = {},
  requestId?: string,
) {
  const tracer = trace.getTracer('agrocylo-backend');

  return tracer.startSpan(name, {
    attributes: {
      ...attributes,
      ...(requestId && { 'request_id': requestId }),
    },
  });
}

/**
 * Execute a function within a traced span.
 * Automatically propagates request context.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  attributes: Record<string, unknown> = {},
  requestId?: string,
): Promise<T> {
  const span = createSpan(name, attributes, requestId);

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: 0 }); // OK
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: 2 }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Extract and propagate trace context from request headers.
 * Used to correlate requests across process boundaries.
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const ctx: Record<string, string> = {};

  // Extract x-request-id for correlation
  const requestId = headers['x-request-id'];
  if (typeof requestId === 'string') {
    ctx['x-request-id'] = requestId;
  }

  // Extract W3C Trace Context headers
  const traceParent = headers['traceparent'];
  if (typeof traceParent === 'string') {
    ctx['traceparent'] = traceParent;
  }

  return ctx;
}

/**
 * Capture an exception with request context.
 * Useful for manual error handling in async contexts.
 */
export function captureException(error: Error, context: Record<string, unknown> = {}): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with structured context.
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
  Sentry.captureMessage(message, level);
}
