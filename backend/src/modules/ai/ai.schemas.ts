import { z } from "zod";

export const parseRequestSchema = z.object({
  body: z.object({
    rawText: z.string().trim().min(1).max(500)
  })
});

// Bounds the model (or any provider) is allowed to return. Anything outside
// this is rejected before it is even shown to the user for review.
export const aiFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000),
  unit: z.enum(["G", "ML", "PIECE", "CUP", "TBSP", "TSP", "OZ"]),
  meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]),
  estimatedCalories: z.number().min(0).max(5000),
  estimatedProteinG: z.number().min(0).max(500),
  estimatedCarbG: z.number().min(0).max(500),
  estimatedFatG: z.number().min(0).max(500)
});

export const aiParsedOutputSchema = z.object({
  items: z.array(aiFoodItemSchema).min(0).max(20)
});

export const acceptParseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    items: z
      .array(
        aiFoodItemSchema.extend({
          loggedAt: z.coerce.date().max(new Date(Date.now() + 24 * 60 * 60 * 1000))
        })
      )
      .min(1)
      .max(20)
  })
});
