import type { Request, Response } from 'express';
import logger from '../config/logger.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    detail: string,
    public readonly type = 'about:blank',
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, identifier?: string) {
    const detail = identifier ? `${resource} not found: ${identifier}` : `${resource} not found`;
    super(404, 'Not Found', detail, 'https://cylos.io/errors/not-found');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public readonly details?: Record<string, string>) {
    super(400, 'Bad Request', message, 'https://cylos.io/errors/validation');
    this.name = 'ValidationError';
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'Unauthorized', message, 'https://cylos.io/errors/unauthorized');
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'Forbidden', message, 'https://cylos.io/errors/forbidden');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'Conflict', message, 'https://cylos.io/errors/conflict');
    this.name = 'ConflictError';
  }
}

export function sendProblem(res: Response, req: Request, error: ApiError): void {
  res
    .status(error.status)
    .type('application/problem+json')
    .json({
      type: error.type,
      title: error.title,
      status: error.status,
      detail: error.message,
      instance: req.originalUrl,
    });
}

export function handleServiceError(err: unknown, req: Request, res: Response): void {
  if (err instanceof ApiError) {
    logger.warn(`[${err.name}] ${err.message}`, { path: req.path, method: req.method, status: err.status });
    sendProblem(res, req, err);
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled service error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  sendProblem(res, req, new ApiError(500, 'Internal Server Error', 'An unexpected error occurred'));
}
