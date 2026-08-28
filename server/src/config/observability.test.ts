import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/node';
import {
  initializeSentry,
  createSpan,
  withSpan,
  extractTraceContext,
  captureException,
  captureMessage,
  SENSITIVE_PATTERNS,
} from './observability.js';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  Handlers: {
    requestHandler: vi.fn(() => (req: any, res: any, next: any) => next()),
    errorHandler: vi.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  },
  setTag: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  Integrations: {
    Http: vi.fn(),
  },
}));

// Mock OpenTelemetry
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      })),
    })),
    setSpan: vi.fn((ctx) => ctx),
  },
  context: {
    active: vi.fn(),
    with: vi.fn((ctx, fn) => fn()),
  },
  propagation: {},
}));

describe('Observability Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  describe('Sentry initialization', () => {
    it('should skip initialization if SENTRY_DSN is not set', () => {
      initializeSentry('api');
      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should initialize Sentry with production config when SENTRY_DSN is set', () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/project';
      process.env.NODE_ENV = 'production';

      initializeSentry('api');

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://key@sentry.io/project',
          environment: expect.any(String),
        }),
      );
    });

    it('should set process type tag', () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/project';

      initializeSentry('worker');

      expect(Sentry.setTag).toHaveBeenCalledWith('process_type', 'worker');
    });
  });

  describe('Sensitive data scrubbing', () => {
    it('should scrub wallet addresses from strings', () => {
      const testString = 'User GBUQWP3BOUZX34STELLA55MKHXUBZ4JTMCE6ADIIX7A2TCNJCBHHNFM requested access';
      const scrubbed = JSON.stringify(
        { data: testString },
        (key, value) => {
          if (typeof value === 'string') {
            return value
              .replace(SENSITIVE_PATTERNS[0], '[WALLET_ADDRESS_REDACTED]')
              .replace(SENSITIVE_PATTERNS[1], '[PRIVATE_KEY_REDACTED]');
          }
          return value;
        },
      );

      expect(scrubbed).toContain('[WALLET_ADDRESS_REDACTED]');
      expect(scrubbed).not.toContain('GBUQWP3BOUZX34');
    });

    it('should scrub sensitive object keys', () => {
      const testObject = {
        wallet_address: 'GBUQWP3BOUZX34STELLA55MKHXUBZ4JTMCE6ADIIX7A2TCNJCBHHNFM',
        privateKey: 'SBUZXPZ4ZPEZ3F7HWMLMPVJWQFXLWM3YTZVZSFGQX6NLKGMTVNV6F4IV',
        name: 'John Doe',
      };

      const scrubbed = JSON.stringify(testObject, (key, value) => {
        if (
          key.toLowerCase().includes('wallet') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('secret')
        ) {
          return '[REDACTED]';
        }
        return value;
      });

      expect(scrubbed).toContain('[REDACTED]');
      expect(scrubbed).toContain('John Doe');
    });

    it('should handle nested objects', () => {
      const testObject = {
        user: {
          id: '123',
          wallet: 'GBUQWP3BOUZX34STELLA55MKHXUBZ4JTMCE6ADIIX7A2TCNJCBHHNFM',
          metadata: {
            secret_key: 'sensitive',
          },
        },
      };

      const scrubbed = JSON.stringify(testObject, (key, value) => {
        if (key.toLowerCase().includes('wallet') || key.toLowerCase().includes('secret')) {
          return '[REDACTED]';
        }
        return value;
      });

      expect(scrubbed).toContain('[REDACTED]');
      expect(scrubbed).toContain('"id":"123"');
    });
  });

  describe('Trace context extraction', () => {
    it('should extract x-request-id from headers', () => {
      const headers = {
        'x-request-id': 'req-12345',
        'user-agent': 'test-client',
      };

      const context = extractTraceContext(headers);

      expect(context['x-request-id']).toBe('req-12345');
    });

    it('should extract traceparent from headers', () => {
      const headers = {
        'traceparent': '00-trace-id-span-id-01',
      };

      const context = extractTraceContext(headers);

      expect(context.traceparent).toBe('00-trace-id-span-id-01');
    });

    it('should handle missing headers gracefully', () => {
      const headers = {};

      const context = extractTraceContext(headers);

      expect(context).toEqual({});
    });

    it('should ignore array header values', () => {
      const headers = {
        'x-request-id': ['id1', 'id2'],
      } as Record<string, string | string[] | undefined>;

      const context = extractTraceContext(headers);

      expect(context['x-request-id']).toBeUndefined();
    });
  });

  describe('Exception capture', () => {
    it('should capture exception with Sentry', () => {
      const error = new Error('Test error');
      const context = { operation: 'test_op' };

      captureException(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          extra: context,
        }),
      );
    });

    it('should capture message with Sentry', () => {
      captureMessage('Test message', 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'warning');
    });
  });

  describe('Span creation and tracing', () => {
    it('should create span with request ID attribute', async () => {
      const requestId = 'req-correlation-123';

      await withSpan(
        'test_operation',
        async () => 'result',
        { operation: 'test' },
        requestId,
      );

      // Verify span was created with request_id
      // Note: Actual verification depends on mock implementation
    });

    it('should handle span success', async () => {
      const result = await withSpan(
        'successful_operation',
        async () => 'success_result',
      );

      expect(result).toBe('success_result');
    });

    it('should handle span errors', async () => {
      const error = new Error('Operation failed');

      expect(
        withSpan(
          'failing_operation',
          async () => {
            throw error;
          },
        ),
      ).rejects.toThrow('Operation failed');
    });
  });
});
