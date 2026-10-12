import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { foodLogs, recipeLogs, goalsHistory, weights } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";

const MAX_RANGE_DAYS = 366;

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function getDailyProgress(userId: string, from: Date, to: Date) {
  const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
    throw new AppError("BAD_REQUEST", `Date range must be between 0 and ${MAX_RANGE_DAYS} days`);
  }

  const [foodLogRows, recipeLogRows, goalRows, weightRows] = await Promise.all([
    db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedDate, from), lte(foodLogs.loggedDate, to))),
    db
      .select()
      .from(recipeLogs)
      .where(
        and(eq(recipeLogs.userId, userId), gte(recipeLogs.loggedDate, from), lte(recipeLogs.loggedDate, to))
      ),
    db
      .select()
      .from(goalsHistory)
      .where(and(eq(goalsHistory.userId, userId), lte(goalsHistory.effectiveFrom, endOfDay(to))))
      .orderBy(goalsHistory.effectiveFrom),
    db
      .select()
      .from(weights)
      .where(and(eq(weights.userId, userId), gte(weights.recordedAt, from), lte(weights.recordedAt, to)))
  ]);

  const byDate = new Map<string, { calories: number; proteinG: number; carbG: number; fatG: number }>();

  for (const log of foodLogRows) {
    addToDay(byDate, log.loggedDate, {
      calories: Number(log.caloriesSnapshot),
      proteinG: Number(log.proteinGSnapshot),
      carbG: Number(log.carbGSnapshot),
      fatG: Number(log.fatGSnapshot)
    });
  }
  for (const log of recipeLogRows) {
    addToDay(byDate, log.loggedDate, {
      calories: Number(log.caloriesSnapshot),
      proteinG: Number(log.proteinGSnapshot),
      carbG: Number(log.carbGSnapshot),
      fatG: Number(log.fatGSnapshot)
    });
  }

  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, totals]) => {
      // Compare by calendar day, not exact timestamp: a goal calculated at
      // 5pm today must still apply when rolling up today's totals.
      const applicableGoal = [...goalRows]
        .reverse()
        .find((g) => g.effectiveFrom.toISOString().slice(0, 10) <= date);
      return {
        date,
        totals,
        calorieTarget: applicableGoal ? Number(applicableGoal.calorieTarget) : null
      };
    });

  return {
    days,
    weights: weightRows.map((w) => ({ date: w.recordedAt, weightKg: Number(w.weightKg) }))
  };
}

function addToDay(
  map: Map<string, { calories: number; proteinG: number; carbG: number; fatG: number }>,
  date: Date,
  values: { calories: number; proteinG: number; carbG: number; fatG: number }
) {
  const key = date.toISOString().slice(0, 10);
  const existing = map.get(key) ?? { calories: 0, proteinG: 0, carbG: 0, fatG: 0 };
  existing.calories += values.calories;
  existing.proteinG += values.proteinG;
  existing.carbG += values.carbG;
  existing.fatG += values.fatG;
  map.set(key, existing);
}
