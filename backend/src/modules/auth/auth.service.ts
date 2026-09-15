import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, refreshTokens, verificationTokens } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { signAccessToken } from "../../lib/jwt.js";
import { env } from "../../config/env.js";

const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export async function registerUser(email: string, password: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new AppError("CONFLICT", "An account with this email already exists");

  const passwordHash = await argon2.hash(password, ARGON2_OPTS);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();

  const verifyToken = generateOpaqueToken();
  await db.insert(verificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(verifyToken),
    purpose: "EMAIL_VERIFY",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return { user, verifyToken };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!record || record.purpose !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "Invalid or expired verification token");
  }

  await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, record.id));
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, record.userId));
}

export async function loginUser(
  email: string,
  password: string,
  meta: { userAgent?: string; ip?: string }
): Promise<IssuedSession> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const genericError = () => new AppError("UNAUTHORIZED", "Invalid email or password");

  if (!user) {
    await argon2.hash(password, ARGON2_OPTS);
    throw genericError();
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) throw genericError();

  return issueSession(user.id, meta);
}

export async function issueSession(
  userId: string,
  meta: { userAgent?: string; ip?: string },
  familyId: string = randomUUID()
): Promise<IssuedSession> {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function rotateRefreshToken(
  presentedToken: string,
  meta: { userAgent?: string; ip?: string }
): Promise<IssuedSession> {
  const tokenHash = hashToken(presentedToken);
  const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);

  if (!record) throw new AppError("UNAUTHORIZED", "Invalid session");

  if (record.revokedAt) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
    throw new AppError("UNAUTHORIZED", "Session invalidated, please log in again");
  }

  if (record.expiresAt < new Date()) {
    throw new AppError("UNAUTHORIZED", "Session expired");
  }

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, record.id));

  return issueSession(record.userId, meta, record.familyId);
}

export async function revokeRefreshFamily(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!record) return;
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
}

export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return;

  const token = generateOpaqueToken();
  await db.insert(verificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    purpose: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!record || record.purpose !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "Invalid or expired reset token");
  }

  const passwordHash = await argon2.hash(newPassword, ARGON2_OPTS);

  await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, record.id));
  await db.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, record.userId), isNull(refreshTokens.revokedAt)));
}

export async function verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return argon2.verify(user.passwordHash, password);
}
