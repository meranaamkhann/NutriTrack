import { z } from "zod";

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const dateOfBirth = z.coerce.date().refine((d) => d.getTime() <= Date.now(), "Date of birth can't be in the future");
const timezone = z.string().refine(isValidTimezone, "Unknown timezone");

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().max(60).nullable().optional(),
    dateOfBirth: dateOfBirth.optional(),
    sexForCalc: z.enum(["MALE", "FEMALE"]).optional(),
    heightCm: z.number().positive().min(90).max(260).optional(),
    unitPref: z.enum(["METRIC", "IMPERIAL"]).optional(),
    timezone: timezone.optional(),
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

const setupBody = z.object({
  displayName: z.string().trim().max(60).nullable().optional(),
  dateOfBirth,
  sexForCalc: z.enum(["MALE", "FEMALE"]),
  heightCm: z.number().positive().min(90).max(260),
  weightKg: z.number().positive().min(20).max(400),
  activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
  goal: z.enum(["LOSE", "MAINTAIN", "GAIN"]),
  targetWeightKg: z.number().positive().min(20).max(400).nullable().optional(),
  unitPref: z.enum(["METRIC", "IMPERIAL"]).optional(),
  timezone: timezone.optional()
});

export const setupSchema = z.object({ body: setupBody });
export const goalPreviewSchema = z.object({ body: setupBody });

export const manualGoalSchema = z.object({
  body: z
    .object({
      calorieTarget: z.number().min(800, "Targets below 800 kcal aren't supported").max(10000),
      proteinG: z.number().min(0).max(1000).optional(),
      carbG: z.number().min(0).max(1500).optional(),
      fatG: z.number().min(0).max(600).optional()
    })
    .refine(
      (b) => {
        const given = [b.proteinG, b.carbG, b.fatG].filter((v) => v !== undefined).length;
        return given === 0 || given === 3;
      },
      { message: "Provide all three macro targets, or none to split automatically" }
    )
});
