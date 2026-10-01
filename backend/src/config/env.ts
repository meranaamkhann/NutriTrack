import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_DOMAIN: z.string().default("localhost"),
  CORS_ORIGIN: z.string().min(1),
  EXPORT_STORAGE_DIR: z.string().default("./storage/exports"),
  EXPORT_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  AI_PROVIDER_API_KEY: z.string().optional().default(""),
  AI_DAILY_REQUEST_LIMIT_PER_USER: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_PASSWORD_RESET_MAX: z.coerce.number().int().positive().default(5),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default("NutriTrack <no-reply@nutritrack.local>"),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  ARGON2_MEMORY_COST_KB: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
