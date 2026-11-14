import { z } from "zod";

export const createExportSchema = z.object({
  body: z.object({
    format: z.enum(["JSON", "CSV"])
  })
});

// The download token is read from the x-export-token header (preferred: URLs
// end up in logs and browser history). ?token= still works for old clients.
export const exportIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ token: z.string().min(1).max(128).optional() })
});
