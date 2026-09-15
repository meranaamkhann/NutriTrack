import helmet from "helmet";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" }
});

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = randomUUID();
  res.setHeader("x-request-id", id);
  next();
}
