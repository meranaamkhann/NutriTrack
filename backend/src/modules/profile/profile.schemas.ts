import { z } from "zod";

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateProfileSchema = z.object({
  body: z.object({
    dateOfBirth: z.coerce.date().max(new Date()).optional(),
    sexForCalc: z.enum(["MALE", "FEMALE"]).optional(),
    heightCm: z.number().positive().min(90).max(260).optional(),
    unitPref: z.enum(["METRIC", "IMPERIAL"]).optional(),
    timezone: z.string().refine(isValidTimezone, "Unknown timezone").optional(),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]).optional(),
    goal: z.enum(["LOSE", "MAINTAIN", "GAIN"]).optional(),
    targetWeightKg: z.number().positive().min(20).max(400).nullable().optional()
  })
});

export const goalsForDateSchema = z.object({
  query: z.object({
    date: z.coerce.date()
  })
});