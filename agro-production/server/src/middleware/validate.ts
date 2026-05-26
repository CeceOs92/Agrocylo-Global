import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

/**
 * Factory that returns an Express middleware validating req.body against a
 * Zod schema. Returns RFC 7807 Problem Detail on failure.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).type("application/problem+json").json(formatZodError(result.error, req.path));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Factory for validating req.query.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).type("application/problem+json").json(formatZodError(result.error, req.path));
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

/**
 * Factory for validating req.params.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).type("application/problem+json").json(formatZodError(result.error, req.path));
      return;
    }
    req.params = result.data as typeof req.params;
    next();
  };
}

function formatZodError(error: ZodError, instance: string) {
  return {
    type: "https://agrocylo.io/errors/validation-failed",
    title: "Validation Failed",
    status: 400,
    instance,
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}
