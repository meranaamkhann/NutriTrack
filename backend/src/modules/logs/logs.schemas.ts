import { z } from "zod";

export const createLogSchema = z.object({
  body: z.object({
    foodId: z.string().uuid(),
    quantity: z.number().positive().max(100000),
    meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]),
    customMealLabel: z.string().trim().max(60).optional(),
    loggedAt: z.coerce.date().max(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    idempotencyKey: z.string().uuid().optional()
  })
});

export const updateLogSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    quantity: z.number().positive().max(100000).optional(),
    meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]).optional(),
    customMealLabel: z.string().trim().max(60).optional(),
    loggedAt: z.coerce.date().optional()
  })
});

export const logIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const listLogsSchema = z.object({
  query: z.object({
    date: z.coerce.date()
  })
});
