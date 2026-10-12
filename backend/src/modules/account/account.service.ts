import { rm } from "node:fs/promises";
import { and, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  recipeLogs,
  recipeIngredients,
  recipes,
  foodLogs,
  foods,
  weights,
  goalsHistory,
  profiles,
  aiParseRequests,
  exportJobs,
  refreshTokens,
  verificationTokens,
  users
} from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { hashPassword, verifyCurrentPassword } from "../auth/auth.service.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { describeDevice } from "../../lib/userAgent.js";
import { logger } from "../../lib/logger.js";
import {
  emailChangedNoticeEmail,
  passwordChangedEmail,
  sendEmail,
  verificationEmail
} from "../../lib/mailer.js";

// Deletion order matters: recipe ingredients before recipes before owned
// foods (Food has ON DELETE RESTRICT from RecipeIngredient), everything
// else is independent. Done explicitly rather than relying solely on
// cascade so the exact deletion contract is visible and testable.
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const passwordOk = await verifyCurrentPassword(userId, password);
  if (!passwordOk) throw new AppError("INVALID_PASSWORD", "Incorrect password");

  const jobs = await db.select().from(exportJobs).where(eq(exportJobs.userId, userId));
  for (const job of jobs) {
    if (job.filePath) await rm(job.filePath, { force: true });
  }

  const ownedRecipes = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.ownerId, userId));
  const recipeIds = ownedRecipes.map((r) => r.id);

  await db.transaction(async (tx) => {
    await tx.delete(recipeLogs).where(eq(recipeLogs.userId, userId));
    if (recipeIds.length > 0) {
      await tx.delete(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds));
    }
    await tx.delete(recipes).where(eq(recipes.ownerId, userId));
    await tx.delete(foodLogs).where(eq(foodLogs.userId, userId));
    await tx.delete(foods).where(eq(foods.ownerId, userId));
    await tx.delete(weights).where(eq(weights.userId, userId));
    await tx.delete(goalsHistory).where(eq(goalsHistory.userId, userId));
    await tx.delete(profiles).where(eq(profiles.userId, userId));
    await tx.delete(aiParseRequests).where(eq(aiParseRequests.userId, userId));
    await tx.delete(exportJobs).where(eq(exportJobs.userId, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(verificationTokens).where(eq(verificationTokens.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}

export async function getAccountInfo(userId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, emailVerified: users.emailVerified, createdAt: users.createdAt, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError("NOT_FOUND", "Account not found");
  return user;
}

async function revokeOtherSessions(userId: string, currentSessionId?: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        currentSessionId ? ne(refreshTokens.familyId, currentSessionId) : undefined
      )
    );
}

export async function changePassword(
  userId: string,
  currentSessionId: string | undefined,
  currentPassword: string,
  newPassword: string
) {
  if (!(await verifyCurrentPassword(userId, currentPassword))) {
    throw new AppError("INVALID_PASSWORD", "Current password is incorrect");
  }
  if (currentPassword === newPassword) {
    throw new AppError("BAD_REQUEST", "Your new password must be different from the current one");
  }

  const passwordHash = await hashPassword(newPassword);
  const [user] = await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning({ email: users.email });

  // A password change should end every OTHER login, so anyone who had the
  // old password (or a stolen session) is kicked out. This device stays in.
  await revokeOtherSessions(userId, currentSessionId);

  if (user) {
    await sendEmail({ to: user.email, ...passwordChangedEmail() }).catch((err) =>
      logger.error({ err }, "password-changed notice failed to send")
    );
  }
}

export async function changeEmail(userId: string, newEmail: string, password: string) {
  if (!(await verifyCurrentPassword(userId, password))) {
    throw new AppError("INVALID_PASSWORD", "Password is incorrect");
  }

  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new AppError("NOT_FOUND", "Account not found");
  if (current.email === newEmail) throw new AppError("BAD_REQUEST", "That is already your email address");

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
  if (taken) throw new AppError("CONFLICT", "That email is already in use");

  await db.update(users).set({ email: newEmail, emailVerified: false }).where(eq(users.id, userId));

  const token = generateOpaqueToken();
  await db.insert(verificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    purpose: "EMAIL_VERIFY",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  await sendEmail({ to: newEmail, ...verificationEmail(token) }).catch((err) =>
    logger.error({ err }, "verification email for new address failed to send")
  );
  // The old address is told too, so a hijacked session can't quietly move
  // the account somewhere the owner won't notice.
  await sendEmail({ to: current.email, ...emailChangedNoticeEmail(newEmail) }).catch((err) =>
    logger.error({ err }, "email-changed notice failed to send")
  );

  return getAccountInfo(userId);
}

export async function listSessions(userId: string, currentSessionId?: string) {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
    .orderBy(desc(refreshTokens.createdAt));

  // Refresh rotates the token, so each live session has exactly one
  // unrevoked row whose createdAt is its last activity.
  const seen = new Set<string>();
  const sessions = [];
  for (const row of rows) {
    if (seen.has(row.familyId)) continue;
    seen.add(row.familyId);
    sessions.push({
      id: row.familyId,
      device: describeDevice(row.userAgent),
      ip: row.ip,
      lastActiveAt: row.createdAt,
      current: row.familyId === currentSessionId
    });
  }
  return sessions;
}

export async function revokeSession(userId: string, sessionId: string, currentSessionId?: string) {
  if (sessionId === currentSessionId) {
    throw new AppError("BAD_REQUEST", "Use Log out to end this device's session");
  }
  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.familyId, sessionId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (revoked.length === 0) throw new AppError("NOT_FOUND", "Session not found");
}

export async function revokeAllOtherSessions(userId: string, currentSessionId?: string) {
  await revokeOtherSessions(userId, currentSessionId);
}
