import { eq, inArray, and, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { recipes, recipeIngredients, foods, recipeLogs, profiles } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { localDateInTimezone } from "../../lib/timezone.js";

type MealType = (typeof recipeLogs.$inferSelect)["meal"];

interface IngredientInput {
  foodId: string;
  quantity: number;
}

export async function createRecipe(
  userId: string,
  data: { name: string; servings: number; ingredients: IngredientInput[] }
) {
  const foodIds = data.ingredients.map((i) => i.foodId);
  const foundFoods = await db.select().from(foods).where(inArray(foods.id, foodIds));

  if (foundFoods.length !== new Set(foodIds).size) {
    throw new AppError("BAD_REQUEST", "One or more ingredient foods do not exist");
  }
  for (const food of foundFoods) {
    if (food.ownerId && food.ownerId !== userId) {
      throw new AppError("FORBIDDEN", "You do not have access to one of these foods");
    }
  }

  return db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({ ownerId: userId, name: data.name, servings: data.servings })
      .returning();

    await tx.insert(recipeIngredients).values(
      data.ingredients.map((ing, index) => ({
        recipeId: recipe.id,
        foodId: ing.foodId,
        quantity: ing.quantity,
        position: index
      }))
    );

    return recipe;
  });
}

export async function getRecipeWithNutrition(userId: string, recipeId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe || recipe.ownerId !== userId) throw new AppError("NOT_FOUND", "Recipe not found");

  const ingredients = await db
    .select({ ingredient: recipeIngredients, food: foods })
    .from(recipeIngredients)
    .innerJoin(foods, eq(recipeIngredients.foodId, foods.id))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));

  const totals = ingredients.reduce(
    (acc, row) => {
      const ratio = Number(row.ingredient.quantity) / Number(row.food.servingSize);
      acc.calories += Number(row.food.calories) * ratio;
      acc.proteinG += Number(row.food.proteinG) * ratio;
      acc.carbG += Number(row.food.carbG) * ratio;
      acc.fatG += Number(row.food.fatG) * ratio;
      return acc;
    },
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
  );

  const servings = Number(recipe.servings);
  const perServing = {
    calories: round2(totals.calories / servings),
    proteinG: round2(totals.proteinG / servings),
    carbG: round2(totals.carbG / servings),
    fatG: round2(totals.fatG / servings)
  };

  return { recipe, ingredients, totals: mapRound(totals), perServing };
}

export async function listRecipes(userId: string) {
  return db.select().from(recipes).where(eq(recipes.ownerId, userId)).orderBy(recipes.name);
}

export async function deleteRecipe(userId: string, recipeId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe || recipe.ownerId !== userId) throw new AppError("NOT_FOUND", "Recipe not found");
  await db.delete(recipes).where(eq(recipes.id, recipeId));
}

export async function logRecipe(
  userId: string,
  recipeId: string,
  input: { servingsConsumed: number; meal: MealType; loggedAt: Date }
) {
  const { recipe, perServing } = await getRecipeWithNutrition(userId, recipeId);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

  const [created] = await db
    .insert(recipeLogs)
    .values({
      userId,
      recipeId: recipe.id,
      recipeNameSnapshot: recipe.name,
      caloriesSnapshot: round2(perServing.calories * input.servingsConsumed),
      proteinGSnapshot: round2(perServing.proteinG * input.servingsConsumed),
      carbGSnapshot: round2(perServing.carbG * input.servingsConsumed),
      fatGSnapshot: round2(perServing.fatG * input.servingsConsumed),
      servingsConsumed: input.servingsConsumed,
      meal: input.meal,
      loggedDate: localDateInTimezone(input.loggedAt, profile?.timezone ?? "UTC"),
      loggedAt: input.loggedAt
    })
    .returning();

  return created;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapRound<T extends Record<string, number>>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) out[key] = round2(obj[key]) as T[keyof T];
  return out;
}
