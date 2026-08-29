import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';
import logger from '../config/logger.js';
import {
  incrementIdempotencyHits,
  incrementIdempotencyMisses,
  incrementIdempotencyConflicts,
} from '../services/metricsService.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const IN_PROGRESS_MARKER = 'IN_PROGRESS';

export interface IdempotencyCacheEntry {
  status: number;
  body: unknown;
}

/**
 * Creates an idempotency middleware that uses Redis for shared state across replicas.
 *
 * Behavior:
 * - First request with key: Claims the key atomically, executes handler, caches response
 * - Concurrent request (same key, before first completes): Returns 409 Conflict
 * - Retry after first completes: Returns cached response without re-executing handler
 * - Retry after TTL expires: Treats as new request
 */
export function createIdempotencyMiddleware(redisClient: Redis) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER];

    // Only apply to requests with idempotency key
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next();
    }

    const redisKey = `idem:${idempotencyKey}`;

    try {
      // Try to retrieve cached response first
      const cached = await redisClient.get(redisKey);

      if (cached) {
        const entry = JSON.parse(cached) as IdempotencyCacheEntry;

        // Check if this is an in-progress marker
        if (entry.status === IN_PROGRESS_MARKER) {
          incrementIdempotencyConflicts();
          logger.warn('[Idempotency] Concurrent duplicate request rejected', {
            idempotencyKey,
            ip: req.ip,
          });
          res.status(409).json({
            title: 'Conflict',
            detail: 'A request with this idempotency key is already in progress',
            status: 409,
          });
          return;
        }

        // Return cached response
        incrementIdempotencyHits();
        logger.debug('[Idempotency] Cache hit, returning cached response', {
          idempotencyKey,
          cachedStatus: entry.status,
        });
        res.status(entry.status).json(entry.body);
        return;
      }

      // Key doesn't exist; try to claim it atomically
      const claimed = await redisClient.set(
        redisKey,
        JSON.stringify({ status: IN_PROGRESS_MARKER, body: null }),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
        'NX',
      );

      if (!claimed) {
        // Another request claimed it between our check and our SET
        incrementIdempotencyConflicts();
        logger.warn('[Idempotency] Race condition: key claimed by concurrent request', {
          idempotencyKey,
        });
        res.status(409).json({
          title: 'Conflict',
          detail: 'A request with this idempotency key is already in progress',
          status: 409,
        });
        return;
      }

      incrementIdempotencyMisses();
      logger.debug('[Idempotency] Cache miss, claimed key for execution', {
        idempotencyKey,
      });

      // Intercept the response to cache it
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function (body: unknown) {
        const entry: IdempotencyCacheEntry = {
          status: res.statusCode,
          body,
        };

        redisClient.set(
          redisKey,
          JSON.stringify(entry),
          'EX',
          IDEMPOTENCY_TTL_SECONDS,
        ).catch((error) => {
          logger.error('[Idempotency] Failed to cache response', {
            idempotencyKey,
            error,
          });
        });

        return originalJson(body);
      };

      res.send = function (body: unknown) {
        // For non-JSON responses, still try to cache if it's the response body
        if (typeof body === 'object' && body !== null) {
          const entry: IdempotencyCacheEntry = {
            status: res.statusCode,
            body,
          };

          redisClient.set(
            redisKey,
            JSON.stringify(entry),
            'EX',
            IDEMPOTENCY_TTL_SECONDS,
          ).catch((error) => {
            logger.error('[Idempotency] Failed to cache response', {
              idempotencyKey,
              error,
            });
          });
        }

        return originalSend(body);
      };

      next();
    } catch (error) {
      logger.error('[Idempotency] Redis operation failed', {
        idempotencyKey,
        error,
      });
      // Fail open: let the request proceed if Redis is unavailable
      // This prevents idempotency from becoming a bottleneck
      next();
    }
  };
}
