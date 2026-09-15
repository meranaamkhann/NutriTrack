import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { foodLogs, foods, profiles } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { localDateInTimezone } from "../../lib/timezone.js";

type MealType = (typeof foodLogs.$inferSelect)["meal"];

interface CreateLogInput {
  foodId: string;
  quantity: number;
  meal: MealType;
  customMealLabel?: string;
  loggedAt: Date;
  idempotencyKey?: string;
}

export async function createFoodLog(userId: string, input: CreateLogInput) {
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), eq(foodLogs.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing) return existing;
  }

  const [food] = await db.select().from(foods).where(eq(foods.id, input.foodId)).limit(1);
  if (!food) throw new AppError("NOT_FOUND", "Food not found");
  if (food.ownerId && food.ownerId !== userId) {
    throw new AppError("FORBIDDEN", "You do not have access to this food");
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const timezone = profile?.timezone ?? "UTC";

  const ratio = input.quantity / Number(food.servingSize);
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
      loggedDate: localDateInTimezone(input.loggedAt, timezone),
      loggedAt: input.loggedAt,
      entrySource: "MANUAL",
      idempotencyKey: input.idempotencyKey
    })
    .returning();

  return created;
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
