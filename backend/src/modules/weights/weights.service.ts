import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { weights } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";

export async function upsertWeight(
  userId: string,
  data: { weightKg: number; recordedAt: Date; note?: string }
) {
  const [existing] = await db
    .select()
    .from(weights)
    .where(and(eq(weights.userId, userId), eq(weights.recordedAt, data.recordedAt)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(weights)
      .set({ weightKg: data.weightKg, note: data.note })
      .where(eq(weights.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(weights)
    .values({ userId, weightKg: data.weightKg, recordedAt: data.recordedAt, note: data.note })
    .returning();
  return created;
}

export async function listWeights(userId: string, opts: { from?: Date; to?: Date; limit: number }) {
  const conditions = [eq(weights.userId, userId)];
  if (opts.from) conditions.push(gte(weights.recordedAt, opts.from));
  if (opts.to) conditions.push(lte(weights.recordedAt, opts.to));

  return db
    .select()
    .from(weights)
    .where(and(...conditions))
    .orderBy(desc(weights.recordedAt))
    .limit(opts.limit);
}

export async function deleteWeight(userId: string, id: string) {
  const [existing] = await db.select().from(weights).where(eq(weights.id, id)).limit(1);
  if (!existing || existing.userId !== userId) {
    throw new AppError("NOT_FOUND", "Weight entry not found");
  }
  await db.delete(weights).where(eq(weights.id, id));
}
