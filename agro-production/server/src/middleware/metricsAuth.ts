import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';

export function requireMetricsAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!config.metricsApiKey) {
    next();
    return;
  }
  const header = req.header('x-metrics-api-key');
  if (header !== config.metricsApiKey) {
    res.status(401).json({ message: 'Unauthorized: invalid or missing x-metrics-api-key header' });
    return;
  }
  next();
}
