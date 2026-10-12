import { z } from "zod";
import { instantNotFarFuture, loggableDateString } from "../../lib/dates.js";

export const createLogSchema = z.object({
  body: z.object({
    foodId: z.string().uuid(),
    quantity: z.number().positive().max(100000),
    meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]),
    customMealLabel: z.string().trim().max(60).optional(),
    loggedAt: instantNotFarFuture,
    loggedDate: loggableDateString.optional(),
    idempotencyKey: z.string().min(1).max(128).optional()
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
