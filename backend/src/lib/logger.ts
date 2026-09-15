import pino from "pino";
import { isProd } from "../config/env.js";

export const logger = pino({
  level: isProd ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "*.passwordHash",
      "*.tokenHash",
      "*.accessToken",
      "*.refreshToken"
    ],
    censor: "[redacted]"
  }
});
