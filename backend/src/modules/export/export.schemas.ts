import { z } from "zod";

export const createExportSchema = z.object({
  body: z.object({
    format: z.enum(["JSON", "CSV"])
  })
});

export const exportIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ token: z.string().min(1).max(128) })
});
