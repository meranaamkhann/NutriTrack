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
import { hashPassword, verifyCurrentPassword, invalidateOutstandingTokens } from "../auth/auth.service.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { describeDevice } from "../../lib/userAgent.js";
import {
  emailChangedNoticeEmail,
  passwordChangedEmail,
  sendEmailInBackground,
  verificationEmail
} from "../../lib/mailer.js";

// Deletion order matters: recipe ingredients before recipes before owned
// foods (Food has ON DELETE RESTRICT from RecipeIngredient), everything
// else is independent. Done explicitly rather than relying solely on
// cascade so the exact deletion contract is visible and testable.
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const passwordOk = await verifyCurrentPassword(userId, password);
  if (!passwordOk) throw new AppError("INVALID_PASSWORD", "Incorrect password");

  const [account] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (account?.role === "ADMIN") {
    // Audit-log rows point at the admin who made the change and must outlive
    // it, so an admin account can't be deleted until the role is removed.
    throw new AppError("BAD_REQUEST", "Admin accounts can't be deleted. Ask another admin to remove your admin role first.");
  }

  const jobs = await db.select().from(exportJobs).where(eq(exportJobs.userId, userId));
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

  // Files go only after the database delete has committed, so a failed
  // delete can't leave an account whose exports are already gone.
  for (const job of jobs) {
    if (job.filePath) await rm(job.filePath, { force: true });
  }
}

export async function getAccountInfo(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      pendingEmail: users.pendingEmail,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      role: users.role
    })
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
    sendEmailInBackground({ to: user.email, ...passwordChangedEmail() }, "password-changed notice");
  }
}

// The login email does NOT change here. The new address is stored as pending
// and only takes over once its owner opens the verification link, so a typo
// can't lock someone out and a hijacked session can't silently move the
// account somewhere the owner can't see.
export async function changeEmail(userId: string, newEmail: string, password: string) {
  if (!(await verifyCurrentPassword(userId, password))) {
    throw new AppError("INVALID_PASSWORD", "Password is incorrect");
  }

  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new AppError("NOT_FOUND", "Account not found");
  if (current.email === newEmail) throw new AppError("BAD_REQUEST", "That is already your email address");

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
  if (taken) throw new AppError("CONFLICT", "That email is already in use");

  const token = generateOpaqueToken();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ pendingEmail: newEmail }).where(eq(users.id, userId));
    // Links sent for any earlier address must not work any more.
    await invalidateOutstandingTokens(tx, userId, "EMAIL_VERIFY");
    await tx.insert(verificationTokens).values({
      userId,
      tokenHash: hashToken(token),
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  });

  sendEmailInBackground({ to: newEmail, ...verificationEmail(token) }, "verification email for new address");
  sendEmailInBackground({ to: current.email, ...emailChangedNoticeEmail(newEmail) }, "email-change notice");

  return { account: await getAccountInfo(userId), verifyToken: token };
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
