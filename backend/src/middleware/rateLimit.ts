import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { Redis } from "ioredis";
import type { Request } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

function keyByUserOrIp(req: Request): string {
  return req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown");
}

// A single shared Redis-backed store when REDIS_URL is set, so rate limits
// are enforced correctly across multiple server instances. Falls back to
// express-rate-limit's in-memory store for a single-instance/dev setup —
// still correct there, just not shared across processes.
const redisClient = env.REDIS_URL ? new Redis(env.REDIS_URL, { lazyConnect: true }) : null;

if (redisClient) {
  redisClient.on("error", (err: Error) => logger.error({ err }, "redis connection error (rate limiting)"));
  redisClient.connect().catch((err: Error) => logger.error({ err }, "failed to connect to redis for rate limiting"));
}

function sharedStore(prefix: string) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)) as Promise<never>
  });
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("login"),
  message: { error: "RATE_LIMITED", message: "Too many attempts, try again later" }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("register")
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_PASSWORD_RESET_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("password-reset")
});

export const aiParseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("ai-parse")
});

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("export")
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  store: sharedStore("general")
});
