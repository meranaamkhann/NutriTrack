import { eq, and, gte, count } from "drizzle-orm";
import { db } from "../../db/client.js";
import { aiParseRequests, foods, foodLogs, profiles } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { localDateInTimezone } from "../../lib/timezone.js";
import { buildAiProvider, parseAndValidate } from "./ai.provider.js";
import { env } from "../../config/env.js";

type MealType = (typeof foodLogs.$inferSelect)["meal"];
type ServingUnit = (typeof foods.$inferSelect)["servingUnit"];

const provider = buildAiProvider();

export async function requestParse(userId: string, rawText: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ value: countToday }] = await db
    .select({ value: count() })
    .from(aiParseRequests)
    .where(and(eq(aiParseRequests.userId, userId), gte(aiParseRequests.createdAt, since)));

  if (countToday >= env.AI_DAILY_REQUEST_LIMIT_PER_USER) {
    throw new AppError("RATE_LIMITED", "Daily AI parsing limit reached");
  }

  const parsed = await parseAndValidate(provider, rawText);

  const [record] = await db
    .insert(aiParseRequests)
    .values({ userId, rawText, parsedOutput: parsed, accepted: false })
    .returning();

  return { requestId: record.id, items: parsed.items };
}

interface AcceptedItem {
  name: string;
  quantity: number;
  unit: ServingUnit;
  meal: MealType;
  estimatedCalories: number;
  estimatedProteinG: number;
  estimatedCarbG: number;
  estimatedFatG: number;
  loggedAt: Date;
}

export async function acceptParse(userId: string, requestId: string, items: AcceptedItem[]) {
  const [request] = await db
    .select()
    .from(aiParseRequests)
    .where(eq(aiParseRequests.id, requestId))
    .limit(1);
  if (!request || request.userId !== userId) throw new AppError("NOT_FOUND", "AI request not found");
  if (request.accepted) throw new AppError("CONFLICT", "This AI request was already accepted");

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const timezone = profile?.timezone ?? "UTC";

  return db.transaction(async (tx) => {
    const logs = [];
    for (const item of items) {
      const [food] = await tx
        .insert(foods)
        .values({
          name: item.name,
          servingSize: item.quantity,
          servingUnit: item.unit,
          calories: item.estimatedCalories,
          proteinG: item.estimatedProteinG,
          carbG: item.estimatedCarbG,
          fatG: item.estimatedFatG,
          source: "AI_ESTIMATED",
          ownerId: userId,
          verificationStatus: "UNVERIFIED"
        })
        .returning();

      const [log] = await tx
        .insert(foodLogs)
        .values({
          userId,
          foodId: food.id,
          foodNameSnapshot: food.name,
          caloriesSnapshot: item.estimatedCalories,
          proteinGSnapshot: item.estimatedProteinG,
          carbGSnapshot: item.estimatedCarbG,
          fatGSnapshot: item.estimatedFatG,
          servingUnitSnapshot: item.unit,
          quantity: item.quantity,
          meal: item.meal,
          loggedDate: localDateInTimezone(item.loggedAt, timezone),
          loggedAt: item.loggedAt,
          entrySource: "AI_ESTIMATED"
        })
        .returning();
      logs.push(log);
    }

    await tx
      .update(aiParseRequests)
      .set({ accepted: true, parsedOutput: { items } })
      .where(eq(aiParseRequests.id, requestId));

    return logs;
  });
}