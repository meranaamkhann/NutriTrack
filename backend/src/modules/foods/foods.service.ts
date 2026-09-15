import { eq, and, or, isNull, ilike } from "drizzle-orm";
import { db } from "../../db/client.js";
import { foods, recipeIngredients } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";

type FoodInsert = Omit<typeof foods.$inferInsert, "ownerId" | "source" | "verificationStatus">;
type FoodPatch = Partial<FoodInsert>;

export async function createFood(userId: string, data: FoodInsert) {
  const [created] = await db
    .insert(foods)
    .values({ ...data, ownerId: userId, source: "USER", verificationStatus: "UNVERIFIED" })
    .returning();
  return created;
}

export async function updateFood(userId: string, foodId: string, patch: FoodPatch) {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (!food) throw new AppError("NOT_FOUND", "Food not found");
  if (food.ownerId !== userId) throw new AppError("FORBIDDEN", "You do not own this food");

  const [updated] = await db
    .update(foods)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(foods.id, foodId))
    .returning();
  return updated;
}

export async function deleteFood(userId: string, foodId: string) {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (!food) throw new AppError("NOT_FOUND", "Food not found");
  if (food.ownerId !== userId) throw new AppError("FORBIDDEN", "You do not own this food");

  const [usedInRecipe] = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.foodId, foodId))
    .limit(1);
  if (usedInRecipe) {
    throw new AppError("CONFLICT", "This food is used in a recipe; remove it from the recipe first");
  }
  await db.delete(foods).where(eq(foods.id, foodId));
}

export async function searchFoods(userId: string, opts: { q?: string; limit: number }) {
  const ownership = or(eq(foods.ownerId, userId), isNull(foods.ownerId));
  const where = opts.q ? and(ownership, ilike(foods.name, `%${opts.q}%`)) : ownership;

  return db.select().from(foods).where(where).orderBy(foods.name).limit(opts.limit);
}

export async function getFoodById(userId: string, foodId: string) {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (!food) throw new AppError("NOT_FOUND", "Food not found");
  if (food.ownerId && food.ownerId !== userId) {
    throw new AppError("FORBIDDEN", "You do not have access to this food");
  }
  return food;
}
