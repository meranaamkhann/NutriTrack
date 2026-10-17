import { eq, and } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../../db/client.js";
import { foodLogs, foods, profiles } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { localDateInTimezone } from "../../lib/timezone.js";
import { parseLocalDate } from "../../lib/dates.js";

type MealType = (typeof foodLogs.$inferSelect)["meal"];

interface CreateLogInput {
  foodId: string;
  quantity: number;
  meal: MealType;
  customMealLabel?: string;
  loggedAt: Date;
  loggedDate?: string;
  idempotencyKey?: string;
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === UNIQUE_VIOLATION;
}

export async function createFoodLog(userId: string, input: CreateLogInput) {
  const idempotencyKey =
    input.idempotencyKey ??
    createHash("sha256")
      .update(`${userId}:${input.foodId}:${input.quantity}:${input.meal}:${input.loggedDate ?? ""}:${Math.floor(Date.now() / 5000)}`)
      .digest("hex");

  const food = await lookUpAccessibleFood(userId, input.foodId);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const timezone = profile?.timezone ?? "UTC";
  const ratio = input.quantity / Number(food.servingSize);

  try {
    const [created] = await db
      .insert(foodLogs)
      .values({
        userId,
        foodId: food.id,
        foodNameSnapshot: food.name,
        caloriesSnapshot: round2(Number(food.calories) * ratio),
        proteinGSnapshot: round2(Number(food.proteinG) * ratio),
        carbGSnapshot: round2(Number(food.carbG) * ratio),
        fatGSnapshot: round2(Number(food.fatG) * ratio),
        servingUnitSnapshot: food.servingUnit,
        quantity: input.quantity,
        meal: input.meal,
        customMealLabel: input.customMealLabel,
        loggedDate: input.loggedDate ? parseLocalDate(input.loggedDate) : localDateInTimezone(input.loggedAt, timezone),
        loggedAt: input.loggedAt,
        entrySource: "MANUAL",
        idempotencyKey
      })
      .returning();
    return created;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [existing] = await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), eq(foodLogs.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing) return existing;
    throw err;
  }
}

async function lookUpAccessibleFood(userId: string, foodId: string) {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (!food) throw new AppError("NOT_FOUND", "Food not found");
  if (food.ownerId && food.ownerId !== userId) {
    throw new AppError("FORBIDDEN", "You do not have access to this food");
  }
  return food;
}

export async function updateFoodLog(
  userId: string,
  logId: string,
  patch: { quantity?: number; meal?: MealType; customMealLabel?: string; loggedAt?: Date }
) {
  const [existing] = await db.select().from(foodLogs).where(eq(foodLogs.id, logId)).limit(1);
  if (!existing || existing.userId !== userId) throw new AppError("NOT_FOUND", "Log entry not found");

  const data: Partial<typeof foodLogs.$inferInsert> = { ...patch };

  if (patch.quantity !== undefined) {
    const originalQuantity = Number(existing.quantity);
    const ratio = patch.quantity / originalQuantity;
    data.caloriesSnapshot = round2(Number(existing.caloriesSnapshot) * ratio);
    data.proteinGSnapshot = round2(Number(existing.proteinGSnapshot) * ratio);
    data.carbGSnapshot = round2(Number(existing.carbGSnapshot) * ratio);
    data.fatGSnapshot = round2(Number(existing.fatGSnapshot) * ratio);
  }

  if (patch.loggedAt !== undefined) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    data.loggedDate = localDateInTimezone(patch.loggedAt, profile?.timezone ?? "UTC");
  }

  const [updated] = await db.update(foodLogs).set(data).where(eq(foodLogs.id, logId)).returning();
  return updated;
}

export async function deleteFoodLog(userId: string, logId: string) {
  const [existing] = await db.select().from(foodLogs).where(eq(foodLogs.id, logId)).limit(1);
  if (!existing || existing.userId !== userId) throw new AppError("NOT_FOUND", "Log entry not found");
  await db.delete(foodLogs).where(eq(foodLogs.id, logId));
}

export async function listLogsForDate(userId: string, date: Date, timezone: string) {
  const localDate = localDateInTimezone(date, timezone);
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.loggedDate, localDate)))
    .orderBy(foodLogs.loggedAt);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
