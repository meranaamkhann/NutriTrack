import { rm } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
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
import { verifyCurrentPassword } from "../auth/auth.service.js";

// Deletion order matters: recipe ingredients before recipes before owned
// foods (Food has ON DELETE RESTRICT from RecipeIngredient), everything
// else is independent. Done explicitly rather than relying solely on
// cascade so the exact deletion contract is visible and testable.
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const passwordOk = await verifyCurrentPassword(userId, password);
  if (!passwordOk) throw new AppError("UNAUTHORIZED", "Incorrect password");

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
