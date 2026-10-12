import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { eq, and, lt, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  profiles,
  goalsHistory,
  weights,
  foods,
  foodLogs,
  recipes,
  recipeIngredients,
  recipeLogs,
  exportJobs
} from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateOpaqueToken, hashToken, safeEqual } from "../../lib/crypto.js";
import { env } from "../../config/env.js";

type ExportFormat = (typeof exportJobs.$inferSelect)["format"];

async function collectUserData(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [goalHistoryRows, weightRows, foodRows, foodLogRows, recipeRows, recipeLogRows] = await Promise.all([
    db.select().from(goalsHistory).where(eq(goalsHistory.userId, userId)).orderBy(goalsHistory.effectiveFrom),
    db.select().from(weights).where(eq(weights.userId, userId)).orderBy(weights.recordedAt),
    db.select().from(foods).where(eq(foods.ownerId, userId)),
    db.select().from(foodLogs).where(eq(foodLogs.userId, userId)).orderBy(foodLogs.loggedAt),
    db.select().from(recipes).where(eq(recipes.ownerId, userId)),
    db.select().from(recipeLogs).where(eq(recipeLogs.userId, userId)).orderBy(recipeLogs.loggedAt)
  ]);

  const recipeIds = recipeRows.map((r) => r.id);
  const ingredientRows =
    recipeIds.length > 0
      ? await db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds))
      : [];

  return {
    profile,
    goalsHistory: goalHistoryRows,
    weights: weightRows,
    foods: foodRows,
    foodLogs: foodLogRows,
    recipes: recipeRows.map((r) => ({
      ...r,
      ingredients: ingredientRows.filter((i) => i.recipeId === r.id)
    })),
    recipeLogs: recipeLogRows
  };
}

function toCsv(rows: Awaited<ReturnType<typeof collectUserData>>["foodLogs"]): string {
  const header = "date,meal,food,quantity,calories,protein_g,carb_g,fat_g\n";
  const lines = rows.map((log) =>
    [
      log.loggedDate.toISOString().slice(0, 10),
      log.meal,
      `"${log.foodNameSnapshot.replace(/"/g, '""')}"`,
      log.quantity,
      log.caloriesSnapshot,
      log.proteinGSnapshot,
      log.carbGSnapshot,
      log.fatGSnapshot
    ].join(",")
  );
  return header + lines.join("\n");
}

export async function createExport(userId: string, format: ExportFormat) {
  const data = await collectUserData(userId);
  const dir = path.resolve(env.EXPORT_STORAGE_DIR, userId);
  await mkdir(dir, { recursive: true });

  const [job] = await db.insert(exportJobs).values({ userId, format, status: "PENDING" }).returning();

  const fileName = `${job.id}.${format === "JSON" ? "json" : "csv"}`;
  const filePath = path.join(dir, fileName);
  const content = format === "JSON" ? JSON.stringify(data, null, 2) : toCsv(data.foodLogs);
  await writeFile(filePath, content, "utf8");

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.EXPORT_TOKEN_TTL_MINUTES * 60 * 1000);

  await db
    .update(exportJobs)
    .set({ status: "READY", filePath, downloadTokenHash: hashToken(token), expiresAt })
    .where(eq(exportJobs.id, job.id));

  return { jobId: job.id, token, expiresAt, format };
}

export async function downloadExport(userId: string, jobId: string, presentedToken: string) {
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).limit(1);
  if (!job || job.userId !== userId) throw new AppError("NOT_FOUND", "Export not found");
  if (job.status !== "READY" || !job.downloadTokenHash || !job.filePath || !job.expiresAt) {
    throw new AppError("NOT_FOUND", "Export not available");
  }
  if (job.expiresAt < new Date()) {
    await db.update(exportJobs).set({ status: "EXPIRED" }).where(eq(exportJobs.id, job.id));
    throw new AppError("NOT_FOUND", "Export link expired");
  }
  if (!safeEqual(hashToken(presentedToken), job.downloadTokenHash)) {
    throw new AppError("FORBIDDEN", "Invalid download token");
  }

  const content = await readFile(job.filePath);
  return { content, format: job.format };
}

export async function deleteExpiredExportFiles(): Promise<void> {
  const expired = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.status, "READY"), lt(exportJobs.expiresAt, new Date())));
  for (const job of expired) {
    if (job.filePath) await rm(job.filePath, { force: true });
    await db.update(exportJobs).set({ status: "EXPIRED" }).where(eq(exportJobs.id, job.id));
  }
}
