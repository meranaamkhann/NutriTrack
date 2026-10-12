import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { foodLogs, recipeLogs, goalsHistory } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { endOfUtcDay } from "../../lib/dates.js";

type MealType = (typeof foodLogs.$inferSelect)["meal"];
type ServingUnit = (typeof foodLogs.$inferSelect)["servingUnitSnapshot"];

export interface DiaryEntry {
  id: string;
  kind: "FOOD" | "RECIPE";
  name: string;
  amount: number;
  unit: ServingUnit | "SERVING";
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  meal: MealType;
  loggedAt: Date;
  source: "MANUAL" | "AI_ESTIMATED";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The target that applied on that day. Before the very first target was
// ever set there is nothing "in effect", so fall back to the earliest one
// rather than showing an empty ring for days logged before setup.
async function goalForDay(userId: string, localDate: Date) {
  const [effective] = await db
    .select()
    .from(goalsHistory)
    .where(and(eq(goalsHistory.userId, userId), lte(goalsHistory.effectiveFrom, endOfUtcDay(localDate))))
    .orderBy(desc(goalsHistory.effectiveFrom))
    .limit(1);
  const row =
    effective ??
    (await db.select().from(goalsHistory).where(eq(goalsHistory.userId, userId)).orderBy(asc(goalsHistory.effectiveFrom)).limit(1))[0];
  if (!row) return null;
  return {
    calorieTarget: Number(row.calorieTarget),
    proteinGTarget: Number(row.proteinGTarget),
    carbGTarget: Number(row.carbGTarget),
    fatGTarget: Number(row.fatGTarget),
    source: row.source,
    effectiveFrom: row.effectiveFrom
  };
}

export async function getDiary(userId: string, localDate: Date) {
  const [foodRows, recipeRows, goal] = await Promise.all([
    db.select().from(foodLogs).where(and(eq(foodLogs.userId, userId), eq(foodLogs.loggedDate, localDate))),
    db.select().from(recipeLogs).where(and(eq(recipeLogs.userId, userId), eq(recipeLogs.loggedDate, localDate))),
    goalForDay(userId, localDate)
  ]);

  const entries: DiaryEntry[] = [
    ...foodRows.map((r) => ({
      id: r.id,
      kind: "FOOD" as const,
      name: r.foodNameSnapshot,
      amount: Number(r.quantity),
      unit: r.servingUnitSnapshot,
      calories: Number(r.caloriesSnapshot),
      proteinG: Number(r.proteinGSnapshot),
      carbG: Number(r.carbGSnapshot),
      fatG: Number(r.fatGSnapshot),
      meal: r.meal,
      loggedAt: r.loggedAt,
      source: r.entrySource
    })),
    ...recipeRows.map((r) => ({
      id: r.id,
      kind: "RECIPE" as const,
      name: r.recipeNameSnapshot,
      amount: Number(r.servingsConsumed),
      unit: "SERVING" as const,
      calories: Number(r.caloriesSnapshot),
      proteinG: Number(r.proteinGSnapshot),
      carbG: Number(r.carbGSnapshot),
      fatG: Number(r.fatGSnapshot),
      meal: r.meal,
      loggedAt: r.loggedAt,
      source: "MANUAL" as const
    }))
  ].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());

  return { date: localDate.toISOString().slice(0, 10), entries, goal };
}

export async function updateRecipeLog(userId: string, id: string, servingsConsumed: number) {
  const [existing] = await db.select().from(recipeLogs).where(eq(recipeLogs.id, id)).limit(1);
  if (!existing || existing.userId !== userId) throw new AppError("NOT_FOUND", "Entry not found");

  // Scale from the ORIGINAL snapshot, never from the live recipe, so editing
  // a portion can't silently pull in later changes to the recipe.
  const ratio = servingsConsumed / Number(existing.servingsConsumed);
  const [updated] = await db
    .update(recipeLogs)
    .set({
      servingsConsumed,
      caloriesSnapshot: round2(Number(existing.caloriesSnapshot) * ratio),
      proteinGSnapshot: round2(Number(existing.proteinGSnapshot) * ratio),
      carbGSnapshot: round2(Number(existing.carbGSnapshot) * ratio),
      fatGSnapshot: round2(Number(existing.fatGSnapshot) * ratio)
    })
    .where(eq(recipeLogs.id, id))
    .returning();
  return updated;
}

export async function deleteRecipeLog(userId: string, id: string) {
  const [existing] = await db.select().from(recipeLogs).where(eq(recipeLogs.id, id)).limit(1);
  if (!existing || existing.userId !== userId) throw new AppError("NOT_FOUND", "Entry not found");
  await db.delete(recipeLogs).where(eq(recipeLogs.id, id));
}
