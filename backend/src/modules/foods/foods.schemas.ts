import { z } from "zod";

const servingUnit = z.enum(["G", "ML", "PIECE", "CUP", "TBSP", "TSP", "OZ"]);

export const createFoodSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(200).optional(),
    servingSize: z.number().positive().max(100000),
    servingUnit,
    calories: z.number().min(0).max(20000),
    proteinG: z.number().min(0).max(2000),
    carbG: z.number().min(0).max(2000),
    fatG: z.number().min(0).max(2000),
    fiberG: z.number().min(0).max(500).optional()
  })
});

export const updateFoodSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createFoodSchema.shape.body.partial()
});

export const foodIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const searchFoodsSchema = z.object({
  query: z.object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
});
