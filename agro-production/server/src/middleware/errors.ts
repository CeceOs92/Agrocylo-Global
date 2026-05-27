import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger.js";

/**
 * RFC 7807 Problem Detail shape.
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export function problemDetail(
  res: Response,
  req: Request,
  status: number,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
): void {
  const body: ProblemDetail = {
    type: `https://agrocylo.io/errors/${slugify(title)}`,
    title,
    status,
    instance: req.path,
    ...(detail ? { detail } : {}),
    ...extra,
  };
  res.status(status).type("application/problem+json").json(body);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-");
}

// Global unhandled-error middleware (must have 4 params for Express to treat it as error handler).
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error("Unhandled request error", { error: err, path: req.path });
  problemDetail(res, req, 500, "Internal Server Error");
}
