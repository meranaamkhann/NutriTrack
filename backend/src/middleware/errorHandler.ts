import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.getHeader("x-request-id");

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "BAD_REQUEST",
      message: "Request failed validation",
      fields: err.flatten().fieldErrors,
      requestId
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId }, "internal app error");
    }
    res.status(err.status).json({ error: err.code, message: err.message, requestId });
    return;
  }

  logger.error({ err, requestId }, "unhandled error");
  res.status(500).json({ error: "INTERNAL", message: "Something went wrong", requestId });
}
