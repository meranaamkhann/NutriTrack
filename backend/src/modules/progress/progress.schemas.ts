import { z } from "zod";

export const progressRangeSchema = z.object({
  query: z.object({
    from: z.coerce.date(),
    to: z.coerce.date()
  })
});
