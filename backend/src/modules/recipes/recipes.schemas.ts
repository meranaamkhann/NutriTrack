import { z } from "zod";
import { instantNotFarFuture, loggableDateString } from "../../lib/dates.js";

export const createRecipeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    servings: z.number().positive().max(1000),
    ingredients: z
      .array(
        z.object({
          foodId: z.string().uuid(),
          quantity: z.number().positive().max(100000)
        })
      )
      .min(1)
      .max(100)
  })
});

export const recipeIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const logRecipeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    servingsConsumed: z.number().positive().max(1000),
    meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]),
    loggedAt: instantNotFarFuture,
    loggedDate: loggableDateString.optional()
  })
});
