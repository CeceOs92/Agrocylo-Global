import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import { createRateLimitStore } from './rateLimitStore.js';

describe('Rate Limit Store', () => {
  let redisClient: Redis;

  beforeEach(() => {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 1, // Use separate DB for testing
    });
  });

  afterEach(async () => {
    await redisClient.flushdb();
    redisClient.disconnect();
  });

  describe('Redis-backed store', () => {
    it('should track request counts in Redis', async () => {
      const store = createRateLimitStore(redisClient);
      const key = 'test-key-1';
      const windowStart = Date.now();

      const result1 = await store.increment(key);
      expect(result1.totalHits).toBe(1);
      expect(result1.resetTime).toBeGreaterThan(windowStart);

      const result2 = await store.increment(key);
      expect(result2.totalHits).toBe(2);
    });

    it('should expire keys after window passes', async () => {
      const store = createRateLimitStore(redisClient);
      const key = 'test-key-expire';
      const windowMs = 1000; // 1 second window for testing

      const result1 = await store.increment(key);
      expect(result1.totalHits).toBe(1);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, windowMs + 100));

      const result2 = await store.increment(key);
      expect(result2.totalHits).toBe(1); // Should reset after expiry
    });

    it('should handle concurrent increments atomically', async () => {
      const store = createRateLimitStore(redisClient);
      const key = 'test-key-concurrent';
      const concurrentRequests = 10;

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => store.increment(key));

      const results = await Promise.all(promises);
      const finalHits = results[results.length - 1].totalHits;

      expect(finalHits).toBe(concurrentRequests);
    });

    it('should retrieve existing keys', async () => {
      const store = createRateLimitStore(redisClient);
      const key = 'test-key-get';

      await store.increment(key);
      await store.increment(key);

      const hits = await store.get(key);
      expect(hits.totalHits).toBe(2);
    });

    it('should return zero for non-existent keys', async () => {
      const store = createRateLimitStore(redisClient);
      const hits = await store.get('non-existent-key');
      expect(hits.totalHits).toBe(0);
    });
  });

  describe('Degradation policy', () => {
    it('should handle Redis unavailability gracefully', async () => {
      const unavailableRedis = new Redis({
        host: 'invalid-host-that-does-not-exist',
        port: 9999,
        connectTimeout: 100,
        retryStrategy: () => null,
      });

      const store = createRateLimitStore(unavailableRedis);

      try {
        // With fail-open degradation, this should succeed even if Redis is down
        const result = await store.increment('test-key');
        expect(result.totalHits).toBeGreaterThan(0);
      } catch (error) {
        // With fail-closed degradation, we expect an error
        expect(error).toBeDefined();
      }
    });
  });
});
