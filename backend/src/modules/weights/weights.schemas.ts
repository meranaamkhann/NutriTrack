import { z } from "zod";

export const upsertWeightSchema = z.object({
  body: z.object({
    weightKg: z.number().positive().min(20).max(400),
    recordedAt: z.coerce.date(),
    note: z.string().max(280).optional()
  })
});

export const listWeightsSchema = z.object({
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(365).default(90)
  })
});

export const weightIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});
