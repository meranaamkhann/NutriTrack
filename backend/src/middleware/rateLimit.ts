import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";

function keyByUserOrIp(req: Request): string {
  return req.user?.id ?? req.ip ?? "unknown";
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many attempts, try again later" }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_PASSWORD_RESET_MAX,
  standardHeaders: true,
  legacyHeaders: false
});

export const aiParseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false
});

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false
});
