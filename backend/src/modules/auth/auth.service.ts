import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, refreshTokens, verificationTokens } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { signAccessToken } from "../../lib/jwt.js";
import {
  sendEmailInBackground,
  verificationEmail,
  passwordResetEmail,
  accountAlreadyExistsEmail
} from "../../lib/mailer.js";
import { env } from "../../config/env.js";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

// Two tabs (or React StrictMode in dev) can present the same refresh token
// within milliseconds of each other. A token that was rotated away this
// recently, while its session still has a live successor, is treated as that
// harmless race instead of as theft.
export const REFRESH_REUSE_GRACE_MS = 10_000;

const UNIQUE_VIOLATION = "23505";
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION;
}

const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: env.ARGON2_MEMORY_COST_KB, timeCost: env.ARGON2_TIME_COST, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTS);
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type Executor = Pick<typeof db, "insert" | "select" | "update">;

const DAY_MS = 24 * 60 * 60 * 1000;

async function createVerificationToken(
  executor: Executor,
  userId: string,
  purpose: "EMAIL_VERIFY" | "PASSWORD_RESET",
  ttlMs: number
): Promise<string> {
  const token = generateOpaqueToken();
  await executor.insert(verificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + ttlMs)
  });
  return token;
}

// Marks every unused token of this kind for the user as used, so only the
// newest link works.
export async function invalidateOutstandingTokens(
  executor: Executor,
  userId: string,
  purpose: "EMAIL_VERIFY" | "PASSWORD_RESET"
): Promise<void> {
  await executor
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.purpose, purpose), isNull(verificationTokens.usedAt)));
}

// Registering never reveals whether an email is taken. A new address gets a
// verification link; an existing one gets an "you already have an account"
// notice. Both paths do the same password hashing and return the same shape.
export async function registerUser(email: string, password: string): Promise<{ verifyToken?: string }> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  const passwordHash = await argon2.hash(password, ARGON2_OPTS);

  if (!existing) {
    try {
      const [user] = await db.insert(users).values({ email, passwordHash }).returning();
      const verifyToken = await createVerificationToken(db, user.id, "EMAIL_VERIFY", DAY_MS);
      sendEmailInBackground({ to: user.email, ...verificationEmail(verifyToken) }, "verification email");
      return { verifyToken };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost a race with another signup for the same address: fall through.
    }
  }

  sendEmailInBackground({ to: email, ...accountAlreadyExistsEmail() }, "account-exists notice");
  return {};
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const invalid = () => new AppError("BAD_REQUEST", "Invalid or expired verification token");

  const [record] = await db.select().from(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash)).limit(1);
  if (!record || record.purpose !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) throw invalid();

  try {
    await db.transaction(async (tx) => {
      // Claim the token atomically so two requests can't both use it.
      const claimed = await tx
        .update(verificationTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(verificationTokens.id, record.id), isNull(verificationTokens.usedAt)))
        .returning({ id: verificationTokens.id });
      if (claimed.length === 0) throw invalid();

      const [user] = await tx.select().from(users).where(eq(users.id, record.userId)).limit(1);
      if (!user) throw invalid();

      if (user.pendingEmail) {
        // Completing an email change: the new address is proven, so it
        // becomes the login email now.
        await tx.update(users).set({ email: user.pendingEmail, pendingEmail: null, emailVerified: true }).where(eq(users.id, user.id));
      } else {
        await tx.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("CONFLICT", "That email address is already in use by another account");
    }
    throw err;
  }
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

  // A locked account answers exactly like a wrong password (same message,
  // same hashing work), so the lockout can't be used to find out which
  // emails have accounts.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await argon2.hash(password, ARGON2_OPTS);
    throw genericError();
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    const [updated] = await db
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
      .where(eq(users.id, user.id))
      .returning({ attempts: users.failedLoginAttempts });
    if (updated && updated.attempts >= MAX_FAILED_LOGINS) {
      await db
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) })
        .where(eq(users.id, user.id));
    }
    throw genericError();
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
  }

  return issueSession(user.id, meta);
}

export async function issueSession(
  userId: string,
  meta: { userAgent?: string; ip?: string },
  familyId: string = randomUUID(),
  executor: Executor = db
): Promise<IssuedSession> {
  const accessToken = signAccessToken(userId, familyId);
  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);

  await executor.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

// Rotation runs in one transaction that locks the presented token's row, so
// concurrent requests with the same token are handled one after another
// instead of both "winning" a select-then-update race.
export async function rotateRefreshToken(
  presentedToken: string,
  meta: { userAgent?: string; ip?: string }
): Promise<IssuedSession> {
  const tokenHash = hashToken(presentedToken);

  const outcome = await db.transaction(async (tx): Promise<{ session: IssuedSession } | { reject: string }> => {
    const [record] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).for("update").limit(1);
    if (!record) return { reject: "Invalid session" };

    const now = new Date();

    if (record.revokedAt) {
      if (now.getTime() - record.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
        // Rotated away a moment ago. If the session still has a live token it
        // was a race between two requests, not a replay after logout.
        const [live] = await tx
          .select({ id: refreshTokens.id })
          .from(refreshTokens)
          .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)))
          .limit(1);
        if (live) return { session: await issueSession(record.userId, meta, record.familyId, tx) };
      }

      // Genuine reuse of a rotated or revoked token: kill the whole session.
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      return { reject: "Session invalidated, please log in again" };
    }

    if (record.expiresAt < now) return { reject: "Session expired" };

    await tx.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.id, record.id));
    return { session: await issueSession(record.userId, meta, record.familyId, tx) };
  });

  if ("reject" in outcome) throw new AppError("UNAUTHORIZED", outcome.reject);
  return outcome.session;
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

// Same response and nearly the same work whether the account exists or not;
// the email itself is sent in the background.
export async function resendVerificationEmail(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const target = user?.pendingEmail ?? (user && !user.emailVerified ? user.email : null);

  if (!user || !target) {
    hashToken(generateOpaqueToken());
    await db.select({ id: users.id }).from(users).limit(1);
    return;
  }

  await invalidateOutstandingTokens(db, user.id, "EMAIL_VERIFY");
  const verifyToken = await createVerificationToken(db, user.id, "EMAIL_VERIFY", DAY_MS);
  sendEmailInBackground({ to: target, ...verificationEmail(verifyToken) }, "resend verification email");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    hashToken(generateOpaqueToken());
    await db.select({ id: users.id }).from(users).limit(1);
    return;
  }

  const token = await createVerificationToken(db, user.id, "PASSWORD_RESET", 60 * 60 * 1000);
  sendEmailInBackground({ to: user.email, ...passwordResetEmail(token) }, "password reset email");
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const invalid = () => new AppError("BAD_REQUEST", "Invalid or expired reset token");

  const [record] = await db.select().from(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash)).limit(1);
  if (!record || record.purpose !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) throw invalid();

  const passwordHash = await argon2.hash(newPassword, ARGON2_OPTS);

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(verificationTokens.id, record.id), isNull(verificationTokens.usedAt)))
      .returning({ id: verificationTokens.id });
    if (claimed.length === 0) throw invalid();

    // A reset also clears any lockout, and any other reset links still in
    // someone's inbox stop working.
    await tx.update(users).set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, record.userId));
    await invalidateOutstandingTokens(tx, record.userId, "PASSWORD_RESET");
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, record.userId), isNull(refreshTokens.revokedAt)));
  });
}

export async function verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return argon2.verify(user.passwordHash, password);
}

