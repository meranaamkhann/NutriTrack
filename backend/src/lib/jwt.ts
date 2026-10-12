import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  // Identifies the login session (refresh-token family) this token belongs
  // to, so "this device" can be told apart from other devices.
  sid?: string;
}

export function signAccessToken(userId: string, sessionId?: string): string {
  return jwt.sign({ sub: userId, ...(sessionId ? { sid: sessionId } : {}) }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || !("sub" in decoded)) {
    throw new Error("Malformed token payload");
  }
  return { sub: decoded.sub as string, sid: typeof decoded.sid === "string" ? decoded.sid : undefined };
}
