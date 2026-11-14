import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { logger } from "../lib/logger.js";

interface ForeignError {
  type?: string;
  status?: number;
  code?: string;
  cause?: { code?: string };
}

// Postgres error codes that mean "the client sent something the database
// can't hold", not "the server is broken".
const PG_NUMERIC_OUT_OF_RANGE = "22003";
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

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

  const foreign = (typeof err === "object" && err !== null ? err : {}) as ForeignError;

  // body-parser (express.json) failures: bad JSON, body too large.
  if (foreign.type === "entity.parse.failed") {
    res.status(400).json({ error: "BAD_REQUEST", message: "Request body is not valid JSON", requestId });
    return;
  }
  if (foreign.type === "entity.too.large") {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body is too large", requestId });
    return;
  }

  const pgCode = foreign.code ?? foreign.cause?.code;
  if (pgCode === PG_NUMERIC_OUT_OF_RANGE) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A number in this request is outside the allowed range", requestId });
    return;
  }
  if (pgCode === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: "CONFLICT", message: "That already exists", requestId });
    return;
  }
  if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
    res.status(409).json({ error: "CONFLICT", message: "This item is still referenced by other data", requestId });
    return;
  }

  logger.error({ err, requestId }, "unhandled error");
  res.status(500).json({ error: "INTERNAL", message: "Something went wrong", requestId });
}
